export const Platform = {
  OS: 'web',
  select: <T,>(options: { default?: T } & Partial<Record<string, T>>): T | undefined =>
    options.web ?? options.default,
};
