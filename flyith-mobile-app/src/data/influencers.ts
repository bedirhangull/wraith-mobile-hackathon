import type { ImageSourcePropType } from "react-native";

export interface InfluencerLocation {
  city: string;
  countryCode: string;
  flag: string;
}

export interface InfluencerTravelPlan {
  city: string;
  countryCode: string;
  endDate?: string;
  flag: string;
  notes?: string;
  places: string[];
  startDate?: string;
}

export interface Influencer {
  context: string;
  destination: InfluencerLocation;
  handle: string;
  highlight: string;
  id: string;
  image: ImageSourcePropType;
  name: string;
  niche: string;
  origin: InfluencerLocation;
  travelPlan: InfluencerTravelPlan[];
}

const istanbul: InfluencerLocation = {
  city: "İstanbul",
  countryCode: "TR",
  flag: "🇹🇷",
};

export const influencers: Influencer[] = [
  {
    context:
      "Batuhan Furkan traveled from İstanbul, Türkiye to Delhi, India. His route focused on historic landmarks, street culture, and local food.",
    destination: { city: "Delhi", countryCode: "IN", flag: "🇮🇳" },
    handle: "@batuhanfurkan.5",
    highlight: "Travel, lifestyle & vlogs",
    id: "batuhan-furkan-5",
    image: require("../../assets/influencers/batuhan-furkan-5.png"),
    name: "Batuhan Furkan",
    niche: "Travel & lifestyle creator",
    origin: istanbul,
    travelPlan: [
      {
        city: "Delhi",
        countryCode: "IN",
        flag: "🇮🇳",
        notes: "Historic Delhi and local street-food route.",
        places: ["India Gate", "Red Fort", "Humayun’s Tomb", "Chandni Chowk"],
      },
    ],
  },
  {
    context:
      "Emre Durmuş began in Türkiye and followed a multi-country backpacking route across Asia and South America, prioritizing budget travel and local experiences.",
    destination: { city: "75+ countries", countryCode: "WORLD", flag: "🌍" },
    handle: "@emredurmus",
    highlight: "2M+ YouTube",
    id: "emre-durmus",
    image: require("../../assets/influencers/emre-durmus.png"),
    name: "Emre Durmuş",
    niche: "Backpacker vlogs",
    origin: { city: "Türkiye", countryCode: "TR", flag: "🇹🇷" },
    travelPlan: [
      {
        city: "Tokyo",
        countryCode: "JP",
        flag: "🇯🇵",
        notes: "Urban culture and neighborhood exploration.",
        places: ["Shibuya Crossing", "Asakusa", "Meiji Shrine", "Akihabara"],
      },
      {
        city: "Bangkok",
        countryCode: "TH",
        flag: "🇹🇭",
        notes: "Budget-friendly temples and street-food route.",
        places: ["Grand Palace", "Wat Arun", "Chinatown", "Chatuchak Market"],
      },
      {
        city: "Rio de Janeiro",
        countryCode: "BR",
        flag: "🇧🇷",
        notes: "Nature, beaches, and city viewpoints.",
        places: ["Christ the Redeemer", "Sugarloaf Mountain", "Ipanema", "Santa Teresa"],
      },
    ],
  },
  {
    context:
      "Ferit wtcN Karakaya traveled from İstanbul, Türkiye to Santiago, Chile for BBL Masters Santiago 2026 and explored the city’s central landmarks.",
    destination: { city: "Santiago", countryCode: "CL", flag: "🇨🇱" },
    handle: "@wtcn",
    highlight: "BBL Masters Santiago 2026",
    id: "wtcn",
    image: require("../../assets/influencers/wtcn.png"),
    name: 'Ferit "wtcN" Karakaya',
    niche: "Esports & gaming entrepreneur",
    origin: istanbul,
    travelPlan: [
      {
        city: "Santiago",
        countryCode: "CL",
        flag: "🇨🇱",
        notes: "Tournament trip combined with a compact Santiago city route.",
        places: ["Plaza de Armas", "Cerro San Cristóbal", "Bellavista", "Sky Costanera"],
      },
    ],
  },
  {
    context:
      "Kemal Can Parlak traveled from İstanbul, Türkiye to Santiago, Chile and followed a city route around culture, viewpoints, and local neighborhoods.",
    destination: { city: "Santiago", countryCode: "CL", flag: "🇨🇱" },
    handle: "@kendinemuzisyen",
    highlight: "BBL co-founder",
    id: "kendine-muzisyen",
    image: require("../../assets/influencers/kendine-muzisyen.png"),
    name: "Kemal Can Parlak",
    niche: "Musician & entrepreneur",
    origin: istanbul,
    travelPlan: [
      {
        city: "Santiago",
        countryCode: "CL",
        flag: "🇨🇱",
        notes: "Music, culture, and city-view itinerary.",
        places: ["Plaza de Armas", "Lastarria", "Cerro Santa Lucía", "Central Market"],
      },
    ],
  },
  {
    context:
      "Yağmur Arat traveled solo from İstanbul, Türkiye to Tokyo, Japan and explored iconic districts, temples, and contemporary art spaces.",
    destination: { city: "Tokyo", countryCode: "JP", flag: "🇯🇵" },
    handle: "@yagmurarat",
    highlight: "YouTube creator",
    id: "yagmur-arat",
    image: require("../../assets/influencers/yagmur-arat.png"),
    name: "Yağmur Arat",
    niche: "Solo female travel",
    origin: istanbul,
    travelPlan: [
      {
        city: "Tokyo",
        countryCode: "JP",
        flag: "🇯🇵",
        notes: "Solo-friendly culture, food, and modern Tokyo route.",
        places: ["Shibuya", "Senso-ji", "Meiji Shrine", "teamLab Planets"],
      },
    ],
  },
  {
    context:
      "Hızlı Gezginler traveled from İstanbul, Türkiye to Dubai, United Arab Emirates and created a fast-paced route mixing landmarks, old Dubai, and coastal areas.",
    destination: { city: "Dubai", countryCode: "AE", flag: "🇦🇪" },
    handle: "@hizligezginler",
    highlight: "448K followers · 45 countries",
    id: "hizli-gezginler",
    image: require("../../assets/influencers/hizli-gezginler.png"),
    name: "Hızlı Gezginler",
    niche: "Cousin travel duo",
    origin: istanbul,
    travelPlan: [
      {
        city: "Dubai",
        countryCode: "AE",
        flag: "🇦🇪",
        notes: "High-energy Dubai highlights and neighborhood route.",
        places: ["Burj Khalifa", "Al Fahidi", "Dubai Marina", "Palm Jumeirah"],
      },
    ],
  },
  {
    context:
      "Kemal Kaya traveled from İstanbul, Türkiye to Bangkok, Thailand and built a digital-nomad route around temples, markets, and local neighborhoods.",
    destination: { city: "Bangkok", countryCode: "TH", flag: "🇹🇭" },
    handle: "@yoldaolmak",
    highlight: "10 years of full-time travel",
    id: "kemal-kaya",
    image: require("../../assets/influencers/kemal-kaya.png"),
    name: "Kemal Kaya",
    niche: "Digital nomad",
    origin: istanbul,
    travelPlan: [
      {
        city: "Bangkok",
        countryCode: "TH",
        flag: "🇹🇭",
        notes: "Slow-travel route suited to a digital-nomad stay.",
        places: ["Grand Palace", "Wat Arun", "Chinatown", "Chatuchak Market"],
      },
    ],
  },
  {
    context:
      "Murad Osmann traveled from Moscow, Russia to Barcelona, Spain and photographed a luxury route through the city’s architecture and coastline.",
    destination: { city: "Barcelona", countryCode: "ES", flag: "🇪🇸" },
    handle: "@muradosmann",
    highlight: "Forbes Top 3 travel influencer",
    id: "murad-osmann",
    image: require("../../assets/influencers/murad-osmann.png"),
    name: "Murad Osmann",
    niche: "Luxury · #FollowMeTo",
    origin: { city: "Moscow", countryCode: "RU", flag: "🇷🇺" },
    travelPlan: [
      {
        city: "Barcelona",
        countryCode: "ES",
        flag: "🇪🇸",
        notes: "Architecture, photography, and luxury city route.",
        places: ["Sagrada Família", "Park Güell", "Gothic Quarter", "Barceloneta"],
      },
    ],
  },
  {
    context:
      "Arda Bayram, known as Tropik, traveled from İstanbul, Türkiye to Bali, Indonesia and explored tropical nature, temples, and creator-friendly coastal areas.",
    destination: { city: "Bali", countryCode: "ID", flag: "🇮🇩" },
    handle: "@ardabayram",
    highlight: "Tropik creator",
    id: "arda-bayram",
    image: require("../../assets/influencers/arda-bayram.png"),
    name: "Arda Bayram (Tropik)",
    niche: "Travel & entertainment creator",
    origin: istanbul,
    travelPlan: [
      {
        city: "Bali",
        countryCode: "ID",
        flag: "🇮🇩",
        notes: "Tropical lifestyle, nature, and beach-content route.",
        places: ["Ubud", "Tegallalang Rice Terraces", "Tanah Lot", "Canggu"],
      },
    ],
  },
  {
    context:
      "Videoyun Batu Bozkan traveled from İstanbul, Türkiye to Tokyo, Japan and followed a gaming, technology, and pop-culture focused route.",
    destination: { city: "Tokyo", countryCode: "JP", flag: "🇯🇵" },
    handle: "@videoyunbatubozkan",
    highlight: "Gaming & travel creator",
    id: "videoyun-batu-bozkan",
    image: require("../../assets/influencers/videoyun-batu-bozkan.png"),
    name: "Videoyun Batu Bozkan",
    niche: "Gaming, lifestyle & travel",
    origin: istanbul,
    travelPlan: [
      {
        city: "Tokyo",
        countryCode: "JP",
        flag: "🇯🇵",
        notes: "Gaming, technology, and Japanese pop-culture itinerary.",
        places: ["Akihabara", "Shibuya", "Pokémon Center", "teamLab Planets"],
      },
    ],
  },
  {
    context:
      "Doğu Deniz Uğur traveled from İstanbul, Türkiye to Paris, France and explored classic landmarks, museums, and photogenic neighborhoods.",
    destination: { city: "Paris", countryCode: "FR", flag: "🇫🇷" },
    handle: "@dogudenizugur",
    highlight: "Travel creator",
    id: "dogu-deniz-ugur",
    image: require("../../assets/influencers/dogu-deniz-ugur.png"),
    name: "Doğu Deniz Uğur",
    niche: "Travel & lifestyle creator",
    origin: istanbul,
    travelPlan: [
      {
        city: "Paris",
        countryCode: "FR",
        flag: "🇫🇷",
        notes: "Landmarks, art, and walkable neighborhood route.",
        places: ["Eiffel Tower", "Louvre Museum", "Montmartre", "Seine River"],
      },
    ],
  },
  {
    context:
      "The Bucket List Family traveled from the United States to Malé, Maldives and explored family-friendly islands, beaches, and marine-life experiences.",
    destination: { city: "Malé", countryCode: "MV", flag: "🇲🇻" },
    handle: "@thebucketlistfamily",
    highlight: "3.1M followers",
    id: "bucket-list-family",
    image: require("../../assets/influencers/bucket-list-family.png"),
    name: "Bucket List Family",
    niche: "Family travel",
    origin: { city: "United States", countryCode: "US", flag: "🇺🇸" },
    travelPlan: [
      {
        city: "Malé",
        countryCode: "MV",
        flag: "🇲🇻",
        notes: "Family-friendly island and marine-life itinerary.",
        places: ["Malé", "Maafushi", "Ari Atoll", "Baa Atoll"],
      },
    ],
  },
  {
    context:
      "Yiğit Mandıroğlu traveled from İstanbul, Türkiye to Amsterdam, Netherlands and explored canals, art museums, and local neighborhoods.",
    destination: { city: "Amsterdam", countryCode: "NL", flag: "🇳🇱" },
    handle: "@yigitmandiroglu",
    highlight: "Travel creator",
    id: "yigit-mandiroglu",
    image: require("../../assets/influencers/yigit-mandiroglu.png"),
    name: "Yiğit Mandıroğlu",
    niche: "Travel & lifestyle creator",
    origin: istanbul,
    travelPlan: [
      {
        city: "Amsterdam",
        countryCode: "NL",
        flag: "🇳🇱",
        notes: "Art, canal walks, and local neighborhood itinerary.",
        places: ["Rijksmuseum", "Jordaan", "Canal Belt", "Van Gogh Museum"],
      },
    ],
  },
  {
    context:
      "Mustafa Sözen, known as Apple Adam, traveled from İstanbul to Ankara, Türkiye and followed a technology-friendly cultural city route.",
    destination: { city: "Ankara", countryCode: "TR", flag: "🇹🇷" },
    handle: "@mustafasozen",
    highlight: "Apple enthusiast · Ankara plan",
    id: "mustafa-sozen",
    image: require("../../assets/influencers/mustafa-sozen.png"),
    name: "Mustafa Sözen (Apple Adam)",
    niche: "Apple & lifestyle creator",
    origin: istanbul,
    travelPlan: [
      {
        city: "Ankara",
        countryCode: "TR",
        flag: "🇹🇷",
        notes: "Technology, history, and central Ankara itinerary.",
        places: ["Anıtkabir", "Museum of Anatolian Civilizations", "Hamamönü", "Kocatepe Mosque"],
      },
    ],
  },
  {
    context:
      "Jennifer Tuffen traveled from London, United Kingdom to Dubai, United Arab Emirates and explored luxury hotels, architecture, and old-city contrasts.",
    destination: { city: "Dubai", countryCode: "AE", flag: "🇦🇪" },
    handle: "@izkiz",
    highlight: "2M+ followers",
    id: "jennifer-tuffen",
    image: require("../../assets/influencers/jennifer-tuffen.png"),
    name: "Jennifer Tuffen",
    niche: "Luxury hotel tours",
    origin: { city: "London", countryCode: "GB", flag: "🇬🇧" },
    travelPlan: [
      {
        city: "Dubai",
        countryCode: "AE",
        flag: "🇦🇪",
        notes: "Luxury hotels, architecture, and photography route.",
        places: ["Burj Al Arab", "Atlantis The Palm", "Downtown Dubai", "Al Fahidi"],
      },
    ],
  },
];
