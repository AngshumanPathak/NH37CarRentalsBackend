// services/reviewService.js

export const fetchGoogleReviews = async () => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    throw new Error("Missing Google Places API configuration in environment variables.");
  }

  // Legacy Google Place Details endpoint
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,reviews,user_ratings_total&key=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google API request failed [${response.status}]: ${errorBody}`);
  }

  const data = await response.json();

  // Handle Google Legacy API status responses
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places API error: ${data.status} - ${data.error_message || "Unknown error"}`);
  }

  const reviews = data.result?.reviews;

  // If no reviews exist, return an empty array
  if (!reviews || !Array.isArray(reviews)) {
    return [];
  }

  // Map legacy Google response into the clean objects your frontend expects
  return reviews.map((review: any) => ({
    id: review.time ? String(review.time) : null,
    authorName: review.author_name || "Anonymous",
    authorPhoto: review.profile_photo_url || null,
    authorUrl: review.author_url || null,
    rating: review.rating || 0,
    text: review.text || "",
    relativeTimeDescription: review.relative_time_description || "",
    publishTime: review.time ? new Date(review.time * 1000).toISOString() : null,
  }));
};