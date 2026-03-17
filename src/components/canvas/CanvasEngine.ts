import * as fabric from 'fabric';

export class CanvasEngine {
  canvas: fabric.Canvas;

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = new fabric.Canvas(canvasElement, {
      isDrawingMode: false,
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  setDrawingMode(isDrawing: boolean) {
    this.canvas.isDrawingMode = isDrawing;
  }

  setBrush(color: string, width: number) {
    if (this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = color;
      this.canvas.freeDrawingBrush.width = width;
    }
  }

  addRect(color: string) {
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: color,
      width: 100,
      height: 100,
    });
    this.canvas.add(rect);
  }

  addCircle(color: string) {
    const circle = new fabric.Circle({
      left: 150,
      top: 150,
      fill: color,
      radius: 50,
    });
    this.canvas.add(circle);
  }

  addText(text: string, color: string) {
    const t = new fabric.IText(text, {
      left: 200,
      top: 200,
      fill: color,
    });
    this.canvas.add(t);
  }

  clear() {
    this.canvas.clear();
  }

  dispose() {
    this.canvas.dispose();
  }
}
