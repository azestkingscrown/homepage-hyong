export class HyeongError extends Error {
  readonly pos: number | null;

  constructor(message: string, pos: number | null = null) {
    super(message);
    this.name = "HyeongError";
    this.pos = pos;
  }
}
