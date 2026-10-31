/**
 * A Google Maps search for real vendors of a kind near the event. VendorLens never lists or
 * recommends specific businesses itself; this hands the search to Maps.
 */
export function mapsSearchLink(serviceType: string, city: string): string {
  const params = new URLSearchParams({ api: "1", query: `${serviceType} near ${city}` });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
