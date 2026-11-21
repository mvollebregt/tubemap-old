import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { layoutMetroLines } from './metro-layout';

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

  it('should merge stations from separate lines into an interchange', () => {
    const layout = layoutMetroLines(
      [['A', 'Shared', 'B'], ['C', 'Shared', 'D']],
      6,
      ['#ff0000', '#0000ff'],
    );

    expect(layout.lines).toHaveLength(2);
    expect(layout.transfers).toEqual([
      expect.objectContaining({
        name: 'Shared',
        lineColors: ['#ff0000', '#0000ff'],
      }),
    ]);
  });
});
