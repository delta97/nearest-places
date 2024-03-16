const county = require('./county.json');
const place = require('./place.json');
const state = require('./state.json');
const fs = require('fs');
const csv = require('csv-parser');
const zipcodes = require('./uszips.json');

const counties = async () => {
  try {
    const county_limited = await county.features.map(
      (feature) => feature.properties
    );
    fs.writeFileSync('./county_limited.json', JSON.stringify(county_limited));
  } catch (error) {
    console.error(error);
  }
};

const places = async () => {
  try {
    const place_limited = await place.features.map(
      (feature) => feature.properties
    );
    fs.writeFileSync('./place_limited.json', JSON.stringify(place_limited));
  } catch (error) {
    console.error(error);
  }
};

const states = async () => {
  try {
    const state_limited = await state.features.map(
      (feature) => feature.properties
    );
    fs.writeFileSync('./state_limited.json', JSON.stringify(state_limited));
  } catch (error) {
    console.error(error);
  }
};

const importCSV = async () => {
  let results = [];

  fs.createReadStream('uszips.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      fs.writeFileSync('./uszips.json', JSON.stringify(results));
    });
};

const lookupZipcodesByCity = async (city, state) => {
  let zipcodesList;
  try {
    let matchingZipcodes = zipcodes.filter((zipcode) => zipcode.city === city);
    if (state) {
      matchingZipcodes = matchingZipcodes.filter(
        (zipcode) => zipcode.state_id === state
      );
    }
    zipcodesList = matchingZipcodes.map((zipcode) => zipcode);
    console.log(
      `Zipcodes for ${city}${state ? ', ' + state : ''}:`,
      zipcodesList
    );
  } catch (error) {
    console.error(error);
  }

  return zipcodesList;
};

/**
 * Looks up the city and state based on a given zipcode.
 * @param {string} zipcode - The zipcode to lookup.
 * @returns {object|null} - An object containing the city and state if a match is found, otherwise null.
 */
const lookupCityStateByZipcode = (zipcode) => {
  try {
    const matchingZipcode = zipcodes.find((code) => code.zip === zipcode);
    if (matchingZipcode) {
      const city = matchingZipcode.city;
      const state = matchingZipcode.state_id;
      console.log(`info: ${JSON.stringify(matchingZipcode, null, 2)}`);
      return { city, state };
    } else {
      console.log(`No information found for zipcode ${zipcode}`);
      return null;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
};

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371.0; // Earth's radius in kilometers
  lat1 = toRadians(lat1);
  lon1 = toRadians(lon1);
  lat2 = toRadians(lat2);
  lon2 = toRadians(lon2);

  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;

  const a =
    Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Finds the closest cities to a given place.
 *
 * @param {Object} place_input - The input place object containing latitude and longitude.
 * @param {number} [topN=10] - The number of closest cities to return (default is 10).
 * @returns {Array} An array of objects representing the nearest cities, sorted by distance.
 */
async function findClosestCities(place_input, topN = 10) {
  const targetLat = place_input.lat;
  const targetLon = place_input.lng;
  const distances = await zipcodes
    .filter((zip) => zip.city !== place_input.city) // Filter out zipcodes with the same city name
    .map((zip) => ({
      place: zip,
      distance: haversine(targetLat, targetLon, zip.lat, zip.lng),
    }))
    .sort((a, b) => a.distance - b.distance);

  const nearestCities = [];
  const usedCities = new Set();
  for (const distance of distances) {
    if (!usedCities.has(distance.place.city)) {
      nearestCities.push(distance);
      usedCities.add(distance.place.city);
      if (nearestCities.length === topN) {
        break;
      }
    }
  }

  return nearestCities;
}

const main = async () => {
  //   await counties();
  //   await places();
  //   await states();
  //   await importCSV();
  const args = process.argv.slice(2);
  const zips = await lookupZipcodesByCity(args[0], args[1]);

  const nearest = await findClosestCities(zips[0]);
  console.log(nearest);
  const nearest_cities = await nearest.map(
    (result) =>
      `city: ${result.place.city}, zipcode: ${result.place.zip}, distance: ${result.distance}, population: ${result.place.population}`
  );

  console.log(nearest_cities);
  //   lookupCityStteByZipcode('92024');

  console.log('done');
};

main();
