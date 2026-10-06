import type { Request, Response } from 'express';

// Comprehensive Singapore landmark & town dictionary for robust fallback resolution
const COMMON_SG_DESTINATIONS = [
  // North / North-East
  {
    title: 'AMK Hub',
    address: '53 Ang Mo Kio Avenue 3, Singapore 569933',
    latitude: 1.3694,
    longitude: 103.8485,
    postalCode: '569933'
  },
  {
    title: 'Ang Mo Kio Central',
    address: '712 Ang Mo Kio Avenue 6, Singapore 560712',
    latitude: 1.3712,
    longitude: 103.8474,
    postalCode: '560712'
  },
  {
    title: 'Jubilee Square (Ang Mo Kio)',
    address: '61 Ang Mo Kio Avenue 8, Singapore 569814',
    latitude: 1.3699,
    longitude: 103.8471,
    postalCode: '569814'
  },
  {
    title: 'Junction 8 (Bishan)',
    address: '9 Bishan Place, Singapore 579837',
    latitude: 1.3508,
    longitude: 103.8488,
    postalCode: '579837'
  },
  {
    title: 'NEX (Serangoon)',
    address: '23 Serangoon Central, Singapore 556083',
    latitude: 1.3506,
    longitude: 103.8722,
    postalCode: '556083'
  },
  {
    title: 'Waterway Point (Punggol)',
    address: '83 Punggol Central, Singapore 828761',
    latitude: 1.4067,
    longitude: 103.9022,
    postalCode: '828761'
  },
  {
    title: 'Compass One (Sengkang)',
    address: '1 Sengkang Square, Singapore 545078',
    latitude: 1.3923,
    longitude: 103.8945,
    postalCode: '545078'
  },
  {
    title: 'Northpoint City (Yishun)',
    address: '930 Yishun Avenue 2, Singapore 769098',
    latitude: 1.4295,
    longitude: 103.8362,
    postalCode: '769098'
  },
  {
    title: 'Causeway Point (Woodlands)',
    address: '1 Woodlands Square, Singapore 738099',
    latitude: 1.4361,
    longitude: 103.7865,
    postalCode: '738099'
  },
  {
    title: 'HDB Hub (Toa Payoh)',
    address: '480 Lorong 6 Toa Payoh, Singapore 310480',
    latitude: 1.3324,
    longitude: 103.8474,
    postalCode: '310480'
  },

  // Central / City
  {
    title: 'Marina Bay Sands',
    address: '10 Bayfront Avenue, Singapore 018956',
    latitude: 1.2842,
    longitude: 103.8596,
    postalCode: '018956'
  },
  {
    title: 'Suntec City',
    address: '3 Temasek Boulevard, Singapore 038983',
    latitude: 1.2938,
    longitude: 103.8572,
    postalCode: '038983'
  },
  {
    title: 'ION Orchard',
    address: '2 Orchard Turn, Singapore 238801',
    latitude: 1.3040,
    longitude: 103.8318,
    postalCode: '238801'
  },
  {
    title: 'Takashimaya / Ngee Ann City',
    address: '391 Orchard Road, Singapore 238873',
    latitude: 1.3025,
    longitude: 103.8355,
    postalCode: '238873'
  },
  {
    title: 'Plaza Singapura',
    address: '68 Orchard Road, Singapore 238839',
    latitude: 1.3007,
    longitude: 103.8451,
    postalCode: '238839'
  },
  {
    title: 'Raffles City',
    address: '252 North Bridge Road, Singapore 179103',
    latitude: 1.2939,
    longitude: 103.8532,
    postalCode: '179103'
  },
  {
    title: 'Bugis Junction',
    address: '200 Victoria Street, Singapore 188021',
    latitude: 1.3002,
    longitude: 103.8553,
    postalCode: '188021'
  },
  {
    title: 'VivoCity',
    address: '1 HarbourFront Walk, Singapore 098585',
    latitude: 1.2644,
    longitude: 103.8222,
    postalCode: '098585'
  },

  // East
  {
    title: 'Tampines Mall',
    address: '4 Tampines Central 5, Singapore 529510',
    latitude: 1.3532,
    longitude: 103.9452,
    postalCode: '529510'
  },
  {
    title: 'Our Tampines Hub',
    address: '1 Tampines Walk, Singapore 528523',
    latitude: 1.3530,
    longitude: 103.9405,
    postalCode: '528523'
  },
  {
    title: 'Bedok Mall',
    address: '311 New Upper Changi Road, Singapore 467360',
    latitude: 1.3240,
    longitude: 103.9300,
    postalCode: '467360'
  },
  {
    title: 'Jewel Changi Airport',
    address: '78 Airport Boulevard, Singapore 819666',
    latitude: 1.3602,
    longitude: 103.9897,
    postalCode: '819666'
  },
  {
    title: 'Parkway Parade',
    address: '80 Marine Parade Road, Singapore 449269',
    latitude: 1.3015,
    longitude: 103.9052,
    postalCode: '449269'
  },

  // West
  {
    title: 'Jem (Jurong East)',
    address: '50 Jurong Gateway Road, Singapore 608549',
    latitude: 1.3331,
    longitude: 103.7436,
    postalCode: '608549'
  },
  {
    title: 'Westgate (Jurong East)',
    address: '3 Gateway Drive, Singapore 608532',
    latitude: 1.3345,
    longitude: 103.7425,
    postalCode: '608532'
  },
  {
    title: 'Jurong Point',
    address: '1 Jurong West Central 2, Singapore 648886',
    latitude: 1.3400,
    longitude: 103.7067,
    postalCode: '648886'
  },
  {
    title: 'Clementi Mall',
    address: '3155 Commonwealth Avenue West, Singapore 129588',
    latitude: 1.3152,
    longitude: 103.7652,
    postalCode: '129588'
  }
];

export default async function geocodeHandler(req: Request, res: Response) {
  const query = (req.query.q as string || '').trim();
  if (!query) {
    return res.json({ results: [] });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const oneMapUrl = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const response = await fetch(oneMapUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        const results = data.results.slice(0, 8).map((item: any) => ({
          title: item.SEARCHVAL || item.BUILDING || item.ROAD_NAME,
          address: item.ADDRESS || `${item.BLK_NO || ''} ${item.ROAD_NAME || ''}`.trim(),
          latitude: parseFloat(item.LATITUDE),
          longitude: parseFloat(item.LONGITUDE),
          postalCode: item.POSTAL || ''
        })).filter((item: any) => !isNaN(item.latitude) && !isNaN(item.longitude));

        if (results.length > 0) {
          return res.json({ results, source: 'onemap' });
        }
      }
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn('Geocoding OneMap error:', error.message);
  }

  // Fallback: match against comprehensive Singapore dictionary based on query text
  const cleanQ = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const matched = COMMON_SG_DESTINATIONS.filter(d => {
    const titleClean = d.title.toLowerCase();
    const addrClean = d.address.toLowerCase();
    return (
      titleClean.includes(cleanQ) ||
      cleanQ.includes(titleClean) ||
      addrClean.includes(cleanQ)
    );
  });

  return res.json({ results: matched, source: 'sg_directory' });
}
