// Google Places local-business discovery, ported from the reference CRM app's
// Python google_places service. Uses the Nearby Search + Place Details + Geocode
// REST endpoints over plain fetch (the codebase's provider-call convention).

const NEARBY_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

const LAT_LNG_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
const NEXT_PAGE_TOKEN_DELAY_MS = 2000;

// Friendly category names -> valid Google Places API type strings. Unknown
// categories fall back to type=establishment with the category as a keyword so
// Google still filters by relevance.
const CATEGORY_TO_PLACES_TYPE: Record<string, string> = {
  dental: "dentist", dentist: "dentist", "dental office": "dentist", dentistry: "dentist", orthodontist: "dentist",
  doctor: "doctor", physician: "doctor", medical: "doctor", clinic: "doctor", hospital: "hospital",
  pharmacy: "pharmacy", drugstore: "pharmacy", optometrist: "doctor",
  chiropractor: "physiotherapist", "physical therapy": "physiotherapist", physiotherapy: "physiotherapist",
  veterinarian: "veterinary_care", vet: "veterinary_care", veterinary: "veterinary_care",
  restaurant: "restaurant", restaurants: "restaurant", food: "restaurant", bar: "bar", cafe: "cafe",
  coffee: "cafe", "coffee shop": "cafe", bakery: "bakery", "meal takeaway": "meal_takeaway", "fast food": "meal_takeaway",
  hotel: "lodging", hotels: "lodging", lodging: "lodging", motel: "lodging", inn: "lodging",
  plumber: "plumber", plumbing: "plumber", electrician: "electrician", electrical: "electrician",
  roofing: "roofing_contractor", roofer: "roofing_contractor", contractor: "general_contractor",
  "general contractor": "general_contractor", painter: "painter", painting: "painter", locksmith: "locksmith",
  moving: "moving_company", mover: "moving_company", storage: "storage", hvac: "general_contractor",
  landscaping: "general_contractor", landscaper: "general_contractor", "pest control": "general_contractor",
  cleaning: "general_contractor", janitorial: "general_contractor",
  "auto repair": "car_repair", mechanic: "car_repair", "car repair": "car_repair", "car wash": "car_wash",
  "auto dealer": "car_dealer", "car dealer": "car_dealer",
  store: "store", retail: "store", grocery: "grocery_or_supermarket", supermarket: "grocery_or_supermarket",
  "pet store": "pet_store", florist: "florist", clothing: "clothing_store", electronics: "electronics_store",
  furniture: "furniture_store", hardware: "hardware_store", jewelry: "jewelry_store", "book store": "book_store",
  bookstore: "book_store",
  gym: "gym", fitness: "gym", salon: "beauty_salon", "hair salon": "hair_care", barbershop: "hair_care",
  barber: "hair_care", spa: "spa", "nail salon": "beauty_salon",
  bank: "bank", atm: "atm", accounting: "accounting", accountant: "accounting", lawyer: "lawyer",
  attorney: "lawyer", "law firm": "lawyer", insurance: "insurance_agency", "real estate": "real_estate_agency",
  realtor: "real_estate_agency",
  school: "school", university: "university", daycare: "school", "child care": "school",
  laundry: "laundry", "dry cleaner": "laundry", "gas station": "gas_station", parking: "parking",
  "post office": "post_office", church: "church", "funeral home": "funeral_home",
};

export class GooglePlacesError extends Error {}

export type PlaceLead = {
  placeId: string;
  company: string;
  location: string | null;
  phone: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessType: string;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function resolvePlacesType(category: string): { placesType: string; keyword: string } {
  const normalized = category.trim().toLowerCase();
  const placesType = CATEGORY_TO_PLACES_TYPE[normalized];
  if (placesType) {
    return { placesType, keyword: category };
  }
  return { placesType: "establishment", keyword: category };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GooglePlacesClient {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 20000) {
    const clean = apiKey.trim();
    if (!clean) {
      throw new GooglePlacesError("Google Places API key is missing");
    }
    this.apiKey = clean;
    this.timeoutMs = timeoutMs;
  }

  private async requestJson(url: string, params: Record<string, string>): Promise<JsonObject> {
    const query = new URLSearchParams({ ...params, key: this.apiKey }).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${url}?${query}`, { signal: controller.signal });
    } catch {
      throw new GooglePlacesError("Google Places request failed (network or timeout)");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new GooglePlacesError(`Google Places HTTP error ${response.status}: ${text.slice(0, 200)}`);
    }

    const payload = asObject(await response.json().catch(() => null));
    if (!payload) {
      throw new GooglePlacesError("Google Places returned an invalid response");
    }

    const status = typeof payload.status === "string" ? payload.status : "";
    if (status === "OK" || status === "ZERO_RESULTS") {
      return payload;
    }

    const message = typeof payload.error_message === "string" ? payload.error_message : "Google Places request failed";
    throw new GooglePlacesError(`${status || "ERROR"}: ${message}`);
  }

  // Nearby Search needs "lat,lng". Accept that, or geocode a free-text address.
  async resolveLocation(location: string): Promise<string> {
    const raw = (location || "").trim();
    if (!raw) {
      throw new GooglePlacesError("Location is empty.");
    }

    const match = LAT_LNG_PATTERN.exec(raw);
    if (match) {
      return `${parseFloat(match[1]).toFixed(7)},${parseFloat(match[2]).toFixed(7)}`;
    }

    const payload = await this.requestJson(GEOCODE_URL, { address: raw });
    const results = Array.isArray(payload.results) ? payload.results : [];
    const first = asObject(results[0]);
    const geometry = asObject(first?.geometry);
    const loc = asObject(geometry?.location);
    const lat = loc?.lat;
    const lng = loc?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") {
      throw new GooglePlacesError(`No geocoding results for: ${raw}`);
    }
    return `${lat.toFixed(7)},${lng.toFixed(7)}`;
  }

  private async getPlaceIds(location: string, radius: number, businessType: string, maxPages: number): Promise<string[]> {
    const { placesType, keyword } = resolvePlacesType(businessType);
    let params: Record<string, string> = {
      location,
      radius: String(radius),
      type: placesType,
      keyword,
    };

    const placeIds: string[] = [];
    for (let page = 0; page < maxPages; page += 1) {
      const payload = await this.requestJson(NEARBY_SEARCH_URL, params);
      const results = Array.isArray(payload.results) ? payload.results : [];
      for (const place of results) {
        const placeId = asObject(place)?.place_id;
        if (typeof placeId === "string") {
          placeIds.push(placeId);
        }
      }

      const nextPageToken = typeof payload.next_page_token === "string" ? payload.next_page_token : "";
      if (!nextPageToken || page + 1 >= maxPages) {
        break;
      }
      // The page token takes a moment to become valid.
      await sleep(NEXT_PAGE_TOKEN_DELAY_MS);
      params = { pagetoken: nextPageToken };
    }
    return placeIds;
  }

  private async getPlaceDetails(placeId: string): Promise<PlaceLead | null> {
    const payload = await this.requestJson(PLACE_DETAILS_URL, {
      place_id: placeId,
      fields: "name,vicinity,formatted_phone_number,website,rating,user_ratings_total",
    });
    const details = asObject(payload.result);
    const company = typeof details?.name === "string" ? details.name.trim() : "";
    if (!company) {
      return null;
    }
    return {
      placeId,
      company,
      location: typeof details?.vicinity === "string" ? details.vicinity.trim() : null,
      phone: typeof details?.formatted_phone_number === "string" ? details.formatted_phone_number.trim() : null,
      websiteUrl: typeof details?.website === "string" ? details.website.trim() : null,
      rating: typeof details?.rating === "number" ? details.rating : null,
      reviewCount: typeof details?.user_ratings_total === "number" ? details.user_ratings_total : null,
      businessType: "",
    };
  }

  async discoverBusinesses(options: {
    location: string;
    radius: number;
    businessTypes: string[];
    missingWebsiteOnly?: boolean;
    maxPages?: number;
    maxDetails?: number;
  }): Promise<PlaceLead[]> {
    const resolved = await this.resolveLocation(options.location);
    const maxPages = Math.max(1, Math.min(options.maxPages ?? 2, 3));
    const maxDetails = Math.max(1, Math.min(options.maxDetails ?? 40, 60));
    const seen = new Set<string>();
    const businesses: PlaceLead[] = [];

    for (const businessType of options.businessTypes) {
      const placeIds = await this.getPlaceIds(resolved, options.radius, businessType, maxPages);
      for (const placeId of placeIds) {
        if (businesses.length >= maxDetails) {
          return businesses;
        }
        if (seen.has(placeId)) {
          continue;
        }
        seen.add(placeId);

        const details = await this.getPlaceDetails(placeId);
        if (!details) {
          continue;
        }
        if (options.missingWebsiteOnly && details.websiteUrl) {
          continue;
        }
        businesses.push({ ...details, businessType });
      }
    }
    return businesses;
  }
}
