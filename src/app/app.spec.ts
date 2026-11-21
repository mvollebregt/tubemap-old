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

    expect(layout.stations.map((station) => station.y)).toEqual([220, 220, 220]);
    expect(layout.path).toBe('M 0 220 L 192.00 220');
  });
});
