export function validImage(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2800000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const bytes = Buffer.from(value.split(',')[1], 'base64');
  return bytes.length > 100 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
