// services/reviewService.js

export const fetchGoogleReviews = async () => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    throw new Error("Missing Google Places API configuration in environment variables.");
  }

  
  // Google Places API (New) details endpoint
  const url = `https://places.googleapis.com/v1/places/${placeId}?fields=reviews,rating,userRatingCount&key=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google API request failed [${response.status}]: ${errorBody}`);
  }

  const data = await response.json();

  // If no reviews exist, return an empty array
  if (!data.reviews || !Array.isArray(data.reviews)) {
    return [];
  }

  // Map into a clean, normalized array matching your frontend expectations
  return data.reviews.map((review: { name: any; authorAttribution: { displayName: any; photoUri: any; uri: any; }; rating: any; text: { text: any; }; originalText: { text: any; }; relativePublishTimeDescription: any; publishTime: any; }) => ({
    id: review.name || null,
    authorName: review.authorAttribution?.displayName || "Anonymous",
    authorPhoto: review.authorAttribution?.photoUri || null,
    authorUrl: review.authorAttribution?.uri || null,
    rating: review.rating || 0,
    text: review.text?.text || review.originalText?.text || "",
    relativeTimeDescription: review.relativePublishTimeDescription || "",
    publishTime: review.publishTime || null,
  }));
};