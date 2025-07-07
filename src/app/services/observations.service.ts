import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FhirClientService, Observation } from './fhir-client.service';

export interface ChartDataPoint {
  x: string;
  y: number;
}

export interface ChartDataset {
  label: string;
  data: ChartDataPoint[];
  borderColor?: string;
  backgroundColor?: string;
  tension?: number;
}

export interface ObservationChartData {
  datasets?: ChartDataset[];
}

type GroupedObservations = Record<string, Observation[]>;

@Injectable({ providedIn: 'root' })
export class ObservationsService {
  constructor(private fhir: FhirClientService) {}

  private readonly LOINC_CATEGORIES = {
    'blood-pressure': ['8480-6', '8462-4', '85354-9'],
    a1c: ['4548-4', '17856-6'],
    glucose: ['2339-0', '33747-0'],
    weight: ['29463-7', '3141-9'],
    height: ['8302-2', '3137-7'],
  } as const;

  getObservations(params: Record<string, any> = {}): Observable<Observation[]> {
    return this.fhir.getObservations(params);
  }

  filterByCategory(obs: Observation[], category: string): Observation[] {
    if (category === 'all') return obs;
    const codes = this.LOINC_CATEGORIES[category as keyof typeof this.LOINC_CATEGORIES] as readonly string[];
    if (!codes) return [];
    return obs.filter((o) =>
      o.code?.coding?.some((c) => c.system === 'http://loinc.org' && codes.includes(c.code || '')),
    );
  }

  groupByType(observations: Observation[]): GroupedObservations {
    const grouped: GroupedObservations = {};
    observations.forEach((obs) => {
      if (this.isBloodPressurePanel(obs)) {
        this.processBloodPressureComponents(obs, grouped);
      } else {
        const label = this.getObservationLabel(obs);
        if (label) {
          if (!grouped[label]) grouped[label] = [];
          grouped[label].push(obs);
        }
      }
    });
    return grouped;
  }

  sortByDate(obs: Observation[]): Observation[] {
    return obs.sort((a, b) => {
      const dateA = this.extractObservationDate(a);
      const dateB = this.extractObservationDate(b);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }

  extractObservationValue(obs: Observation, componentCode?: string): number | null {
    if (componentCode && obs.component) {
      const comp = obs.component.find((c) =>
        c.code?.coding?.some((coding) => coding.code === componentCode),
      );
      if (comp?.valueQuantity?.value !== undefined) return comp.valueQuantity.value;
    }
    if (obs.valueQuantity?.value !== undefined) return obs.valueQuantity.value;
    return null;
  }

  extractObservationDate(obs: Observation): string | null {
    if (obs.effectiveDateTime) return obs.effectiveDateTime;
    if (obs.effectivePeriod?.start) return obs.effectivePeriod.start;
    return null;
  }

  getObservationLabel(obs: Observation): string | null {
    if (obs.code?.text) return obs.code.text;
    if (obs.code?.coding?.length) {
      const c = obs.code.coding[0]!;
      return c.display || c.code || null;
    }
    return null;
  }

  detectCategory(obs: Observation): string | null {
    if (!obs.code?.coding) return null;
    for (const [category, codes] of Object.entries(this.LOINC_CATEGORIES)) {
      const codeList = codes as readonly string[];
      const match = obs.code.coding.some(
        (c) => c.system === 'http://loinc.org' && codeList.includes(c.code ?? ''),
      );
      if (match) return category;
    }
    return null;
  }

  formatObservationValue(obs: Observation): string {
    if (this.isBloodPressurePanel(obs)) {
      return this.formatBloodPressureValue(obs);
    }
    const value = this.extractObservationValue(obs);
    if (value === null) return 'N/A';
    const unit = obs.valueQuantity?.unit ?? '';
    return `${value} ${unit}`.trim();
  }

  formatObservationDate(obs: Observation): string {
    const date = this.extractObservationDate(obs);
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  }

  getCategoryDisplayName(category: string): string {
    const names: Record<string, string> = {
      'blood-pressure': 'Blood Pressure',
      a1c: 'Hemoglobin A1c',
      glucose: 'Glucose',
      weight: 'Weight',
      height: 'Height',
    };
    return names[category] || 'Unknown';
  }

  prepareChartData(observations: Observation[], category: string): ObservationChartData {
    const filtered = this.filterByCategory(observations, category);
    if (filtered.length === 0) return { datasets: [] };
    const grouped = this.groupByType(filtered);
    const datasets: ChartDataset[] = [];
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    let index = 0;
    for (const [label, obsArray] of Object.entries(grouped)) {
      const sorted = this.sortByDate(obsArray);
      const data: ChartDataPoint[] = sorted
        .map((obs) => {
          const d = this.extractObservationDate(obs);
          const v = this.extractObservationValue(obs);
          if (!d || v === null || isNaN(v)) return null;
          if (isNaN(new Date(d).getTime())) return null;
          return { x: d, y: v };
        })
        .filter((p): p is ChartDataPoint => p !== null);
      if (data.length > 0) {
        const color = colors[index % colors.length] ?? '#3b82f6';
        datasets.push({
          label,
          data,
          borderColor: color,
          backgroundColor: `${color}20`,
          tension: 0.1,
        });
        index++;
      }
    }
    return { datasets };
  }

  private isBloodPressurePanel(obs: Observation): boolean {
    return (
      obs.code?.coding?.some(
        (coding) => coding.system === 'http://loinc.org' && coding.code === '85354-9',
      ) ?? false
    );
  }

  private processBloodPressureComponents(obs: Observation, grouped: GroupedObservations): void {
    if (!obs.component) return;
    obs.component.forEach((component) => {
      const coding = component.code?.coding?.[0];
      if (!coding) return;
      let label: string | null = null;
      if (coding.code === '8480-6') label = 'Systolic Blood Pressure';
      else if (coding.code === '8462-4') label = 'Diastolic Blood Pressure';
      if (label && component.valueQuantity?.value !== undefined) {
        if (!grouped[label]) grouped[label] = [];
        const { component: _c, ...base } = obs;
        const compObs: Observation = {
          ...base,
          code: component.code || { coding: [] },
          valueQuantity: component.valueQuantity,
        } as Observation;
        grouped[label]!.push(compObs);
      }
    });
  }

  private formatBloodPressureValue(obs: Observation): string {
    if (!obs.component) return 'N/A';
    let systolic: number | null = null;
    let diastolic: number | null = null;
    let unit = '';
    obs.component.forEach((comp) => {
      const coding = comp.code?.coding?.[0];
      if (!coding) return;
      if (coding.code === '8480-6') {
        systolic = comp.valueQuantity?.value ?? null;
        unit = comp.valueQuantity?.unit ?? '';
      } else if (coding.code === '8462-4') {
        diastolic = comp.valueQuantity?.value ?? null;
      }
    });
    if (systolic !== null && diastolic !== null) return `${systolic}/${diastolic} ${unit}`.trim();
    if (systolic !== null) return `${systolic}/- ${unit}`.trim();
    if (diastolic !== null) return `-/${diastolic} ${unit}`.trim();
    return 'N/A';
  }
}
