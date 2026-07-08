let counter = 0;
export function generateId(): string {
  counter++;
  return `id-${counter}-${Date.now()}`;
}
