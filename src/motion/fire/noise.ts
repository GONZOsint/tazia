export class FractalNoise2D {
  private readonly s1: number;
  private readonly s2: number;
  private readonly s3: number;
  private readonly s4: number;
  private readonly octaves: Array<{ gw: number; gh: number; data: Float32Array }>;

  constructor(width: number, height: number, pixelRatio: number) {
    this.s1 = 34 * pixelRatio;
    this.s2 = 16 * pixelRatio;
    this.s3 = 7 * pixelRatio;
    this.s4 = 3 * pixelRatio;
    this.octaves = [
      this.createGrid(Math.ceil(width / this.s1) + 3, Math.ceil(height / this.s1) + 3),
      this.createGrid(Math.ceil(width / this.s2) + 3, Math.ceil(height / this.s2) + 3),
      this.createGrid(Math.ceil(width / this.s3) + 3, Math.ceil(height / this.s3) + 3),
      this.createGrid(Math.ceil(width / this.s4) + 3, Math.ceil(height / this.s4) + 3),
    ];
  }

  private createGrid(gw: number, gh: number) {
    const data = new Float32Array(gw * gh);
    for (let i = 0; i < data.length; i++) data[i] = Math.random();
    return { gw, gh, data };
  }

  private sampleGrid(
    grid: { gw: number; gh: number; data: Float32Array },
    x: number,
    y: number,
    scale: number
  ): number {
    const gx = x / scale;
    const gy = y / scale;
    let x0 = Math.floor(gx);
    let y0 = Math.floor(gy);
    const maxX = grid.gw - 1;
    const maxY = grid.gh - 1;
    x0 = Math.max(0, Math.min(maxX - 1, x0));
    y0 = Math.max(0, Math.min(maxY - 1, y0));
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const sx = gx - Math.floor(gx);
    const sy = gy - Math.floor(gy);
    const u = sx * sx * (3 - 2 * sx);
    const v = sy * sy * (3 - 2 * sy);
    const idx00 = y0 * grid.gw + x0;
    const idx10 = y0 * grid.gw + x1;
    const idx01 = y1 * grid.gw + x0;
    const idx11 = y1 * grid.gw + x1;
    const n0 = grid.data[idx00]! * (1 - u) + grid.data[idx10]! * u;
    const n1 = grid.data[idx01]! * (1 - u) + grid.data[idx11]! * u;
    return n0 * (1 - v) + n1 * v;
  }

  getValue(x: number, y: number): number {
    return (
      this.sampleGrid(this.octaves[0]!, x, y, this.s1) * 0.5 +
      this.sampleGrid(this.octaves[1]!, x, y, this.s2) * 0.26 +
      this.sampleGrid(this.octaves[2]!, x, y, this.s3) * 0.15 +
      this.sampleGrid(this.octaves[3]!, x, y, this.s4) * 0.09
    );
  }
}
