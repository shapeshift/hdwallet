export async function each(
  args: any[],
  callback: (arg: any) => Promise<void>
): Promise<void> {
  for (const arg of args) {
    await callback(arg);
  }
}
