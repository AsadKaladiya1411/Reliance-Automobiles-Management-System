export function formatDocumentNumber(input: {
  prefix: string;
  suffix: string;
  padding: number;
  nextNumber: number;
}) {
  return `${input.prefix}${String(input.nextNumber).padStart(input.padding, "0")}${input.suffix}`;
}
