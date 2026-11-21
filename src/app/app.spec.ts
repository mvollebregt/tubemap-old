import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { MetroMappingService } from './services/metro-mapping.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Stationslijst');
  });

  it('should place stations on one horizontal line', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(['A', 'B', 'C']);

    expect(layout.stations.map((station) => station.y)).toEqual([160, 160, 160]);
    expect(layout.path).toBe('M 0.00 160 L 144.00 160');
  });

  it('should stop the line at the first and last station ticks', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(['A', 'B', 'C']);
    const first = layout.stations[0];
    const last = layout.stations.at(-1)!;

    expect(layout.path.startsWith(`M ${first.x.toFixed(2)} ${first.y}`)).toBe(true);
    expect(layout.path.endsWith(`L ${last.x.toFixed(2)} ${last.y}`)).toBe(true);
  });
});
