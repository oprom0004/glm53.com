/** Keep configuration identity independent of database collation rules. */
export function assertGenericConfigNames(names: string[]) {
  for (const name of names) {
    if (
      name.toLowerCase().startsWith('wan_pricing_') ||
      /^polaris_.*credits_per_second$/i.test(name)
    )
      throw new Error('reserved_pricing_config');
    // Every registered setting uses lower-case ASCII. Reject, rather than
    // normalize, case/accent/compatibility aliases before any database write.
    if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('invalid_config_name');
  }
}
