import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { aiTask, credit } from '@/config/db/schema';
import { AITaskStatus } from '@/extensions/ai';
import { appendUserToResult, User } from '@/shared/models/user';

import { consumeCredits, CreditStatus, CreditTransactionType } from './credit';
import { paymentTransaction } from './payment-transaction';

export type AITask = typeof aiTask.$inferSelect & {
  user?: User;
};
export type NewAITask = typeof aiTask.$inferInsert;
export type UpdateAITask = Partial<Omit<NewAITask, 'id' | 'createdAt'>>;

export async function createAITask(newAITask: NewAITask) {
  const result = await paymentTransaction(async (tx: any) => {
    // 1. create task record
    const [taskResult] = await tx.insert(aiTask).values(newAITask).returning();

    if (newAITask.costCredits && newAITask.costCredits > 0) {
      // 2. consume credits
      const consumedCredit = await consumeCredits({
        userId: newAITask.userId,
        credits: newAITask.costCredits,
        scene: newAITask.scene,
        description: `generate ${newAITask.mediaType}`,
        metadata: JSON.stringify({
          type: 'ai-task',
          mediaType: taskResult.mediaType,
          taskId: taskResult.id,
        }),
        tx,
      });

      // 3. update task record with consumed credit id
      if (consumedCredit && consumedCredit.id) {
        taskResult.creditId = consumedCredit.id;
        await tx
          .update(aiTask)
          .set({ creditId: consumedCredit.id })
          .where(eq(aiTask.id, taskResult.id));
      }
    }

    return taskResult;
  });

  return result;
}

export async function findAITaskById(id: string) {
  const [result] = await db().select().from(aiTask).where(eq(aiTask.id, id));
  return result;
}

export async function updateAITaskById(
  id: string,
  updateAITask: UpdateAITask,
  guard?: { expectedTaskResult?: string; requireNoProviderTaskId?: boolean }
) {
  const result = await paymentTransaction(async (tx: any) => {
    const [task] = await tx
      .select()
      .from(aiTask)
      .where(eq(aiTask.id, id))
      .for('update');
    if (!task) throw new Error('AI task not found');
    if (
      guard?.expectedTaskResult !== undefined &&
      task.taskResult !== guard.expectedTaskResult
    ) {
      return task;
    }
    if (guard?.requireNoProviderTaskId && task.taskId) return task;
    if (
      ['polaris', 'kie-wan'].includes(task.provider) &&
      [AITaskStatus.SUCCESS, AITaskStatus.FAILED].includes(task.status)
    ) {
      return task;
    }
    if (updateAITask.creditId && updateAITask.creditId !== task.creditId) {
      throw new Error('AI task credit association mismatch');
    }

    if (updateAITask.status === AITaskStatus.FAILED && task.creditId) {
      const [consumedCredit] = await tx
        .update(credit)
        .set({ status: CreditStatus.DELETED })
        .where(
          and(
            eq(credit.id, task.creditId),
            eq(credit.userId, task.userId),
            eq(credit.transactionType, CreditTransactionType.CONSUME),
            eq(credit.status, CreditStatus.ACTIVE)
          )
        )
        .returning();

      if (consumedCredit) {
        let consumedItems: any[] = [];
        try {
          const parsed = JSON.parse(consumedCredit.consumedDetail || '[]');
          if (Array.isArray(parsed)) consumedItems = parsed;
        } catch {
          // Keep the consumption claimed and flag the blocked return below.
        }
        let refundBlockedCredits = 0;
        const blockedSources: string[] = [];
        for (const item of consumedItems) {
          if (
            !item?.creditId ||
            !Number.isSafeInteger(item.creditsConsumed) ||
            item.creditsConsumed <= 0
          ) {
            continue;
          }
          const returned = await tx
            .update(credit)
            .set({
              remainingCredits: sql`${credit.remainingCredits} + ${item.creditsConsumed}`,
            })
            .where(
              and(
                eq(credit.id, item.creditId),
                eq(credit.userId, task.userId),
                eq(credit.transactionType, CreditTransactionType.GRANT),
                eq(credit.status, CreditStatus.ACTIVE)
              )
            )
            .returning();
          if (!returned.length) {
            refundBlockedCredits += item.creditsConsumed;
            blockedSources.push(item.creditId);
          }
        }
        let metadata = {};
        try {
          metadata = JSON.parse(consumedCredit.metadata || '{}') || {};
        } catch {
          // Preserve audit metadata even for old malformed records.
        }
        await tx
          .update(credit)
          .set({
            metadata: JSON.stringify({
              ...metadata,
              failedTaskCreditReturn: true,
              refundBlockedCredits,
              blockedSources,
              creditReturnReviewRequired: refundBlockedCredits > 0,
            }),
          })
          .where(eq(credit.id, task.creditId));
      }
    }

    const [result] = await tx
      .update(aiTask)
      .set(updateAITask)
      .where(eq(aiTask.id, id))
      .returning();

    return result;
  });

  return result;
}

export async function getAITasksCount({
  userId,
  status,
  mediaType,
  provider,
}: {
  userId?: string;
  status?: string;
  mediaType?: string;
  provider?: string | string[];
}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        Array.isArray(provider)
          ? inArray(aiTask.provider, provider)
          : provider
            ? eq(aiTask.provider, provider)
            : undefined,
        status ? eq(aiTask.status, status) : undefined
      )
    );

  return result?.count || 0;
}

export async function getAITasks({
  userId,
  status,
  mediaType,
  provider,
  page = 1,
  limit = 30,
  getUser = false,
}: {
  userId?: string;
  status?: string;
  mediaType?: string;
  provider?: string | string[];
  page?: number;
  limit?: number;
  getUser?: boolean;
}): Promise<AITask[]> {
  const result = await db()
    .select()
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        Array.isArray(provider)
          ? inArray(aiTask.provider, provider)
          : provider
            ? eq(aiTask.provider, provider)
            : undefined,
        status ? eq(aiTask.status, status) : undefined
      )
    )
    .orderBy(desc(aiTask.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}
