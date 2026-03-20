import time
from typing import List, Dict, Any, Optional
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize the geocoder with a custom user agent
geolocator = Nominatim(user_agent="ocha_media_sweep_platform/1.0")

def geocode_locations(location_names: List[str]) -> List[Dict[str, Any]]:
    """
    Geocodes a list of location names using Nominatim (OpenStreetMap).

    Args:
        location_names: A list of location name strings.

    Returns:
        A list of dictionaries, where each dictionary represents a
        successfully geocoded location with 'name', 'latitude', and 'longitude'.
    """
    if not location_names:
        return []

    unique_locations = list(set(location_names))
    geocoded_locations = []

    for name in unique_locations:
        try:
            logger.info(f"Geocoding location: {name}")
            location = geolocator.geocode(name)
            if location:
                geocoded_locations.append({
                    "name": name,
                    "latitude": location.latitude,
                    "longitude": location.longitude,
                    "raw": location.raw
                })
            else:
                logger.warning(f"Location not found for: {name}")

            # Nominatim usage policy: max 1 request per second
            time.sleep(1)

        except (GeocoderTimedOut, GeocoderUnavailable) as e:
            logger.error(f"Geocoding service error for '{name}': {e}")
            # Wait a bit longer before the next attempt if the service is unavailable
            time.sleep(2)
        except Exception as e:
            logger.error(f"An unexpected error occurred during geocoding for '{name}': {e}")
            time.sleep(1) # Still respect the rate limit

    return geocoded_locations

async def geocode_locations_async(location_names: List[str]) -> List[Dict[str, Any]]:
    # This is a placeholder for a true async implementation.
    # For now, it wraps the synchronous version.
    # A true async implementation would require an async-compatible geocoding library.
    from fastapi import BackgroundTasks
    
    # In a real-world high-throughput scenario, you would use a proper async geocoding client
    # or run the synchronous one in a thread pool.
    # For this project's scope, we'll stick to the rate-limited sync version.
    return geocode_locations(location_names)

if __name__ == '__main__':
    # Example usage:
    test_locations = ["Khartoum, Sudan", "New York", "Paris", "NonExistentPlace12345"]
    results = geocode_locations(test_locations)
    logger.info(f"Geocoding results: {results}")

