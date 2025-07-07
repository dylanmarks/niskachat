import { Directive, ElementRef, Input, NgZone, OnChanges, OnDestroy } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Directive({
  selector: 'canvas[appChartRenderer]',
  standalone: true,
})
export class ChartRendererDirective implements OnChanges, OnDestroy {
  @Input() chartData?: ChartConfiguration<'line'>['data'];
  @Input() chartOptions?: ChartConfiguration<'line'>['options'];

  private chart: Chart | null = null;

  constructor(private el: ElementRef<HTMLCanvasElement>, private zone: NgZone) {}

  ngOnChanges(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private renderChart(): void {
    if (!this.chartData) {
      this.destroyChart();
      return;
    }

    const ctx = this.el.nativeElement.getContext('2d');
    if (!ctx) return;

    this.destroyChart();
    this.zone.runOutsideAngular(() => {
      this.chart = new Chart(ctx, {
        type: 'line',
        data: this.chartData!,
        options: this.chartOptions,
      });
    });
  }

  private destroyChart(): void {
      if (this.chart) {
        this.zone.runOutsideAngular(() => {
          this.chart!.destroy();
        });
        this.chart = null;
      }
  }
}
