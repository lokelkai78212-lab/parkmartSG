import type { Request, Response } from 'express';

export const LTA_DATAMALL_CARPARK_URL = 'https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2';

export interface LTACarparkRecord {
  CarParkID: string;
  Area: string;
  Development: string;
  Location: string; // "latitude longitude"
  AvailableLots: string | number;
  LotType: 'C' | 'H' | 'Y' | string; // C: Car, H: Heavy, Y: Motorcycle
  Agency: 'HDB' | 'LTA' | 'URA' | string;
}

export interface LTAResponse {
  'odata.metadata'?: string;
  value: LTACarparkRecord[];
}

export interface FetchLTACarparksOptions {
  accountKey?: string;
  skip?: number;
  fetchAll?: boolean;
  timeoutMs?: number;
}

/**
 * Serverless connection utility that pulls live carpark availability
 * (HDB + LTA + URA) from LTA DataMall CarParkAvailabilityv2.
 * Requires the header: AccountKey: <LTA_ACCOUNT_KEY>
 */
export async function fetchLTACarparks(options: FetchLTACarparksOptions = {}): Promise<LTAResponse> {
  const accountKey =
    options.accountKey ||
    process.env.LTA_ACCOUNT_KEY ||
    process.env.LTA_API_KEY;

  if (!accountKey) {
    throw new Error('Missing LTA AccountKey. Please set LTA_ACCOUNT_KEY or pass AccountKey header.');
  }

  const timeoutMs = options.timeoutMs ?? 8000;

  // Single page fetch
  if (!options.fetchAll) {
    const skipParam = options.skip !== undefined ? `?$skip=${options.skip}` : '';
    const targetUrl = `${LTA_DATAMALL_CARPARK_URL}${skipParam}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'AccountKey': accountKey,
          'Accept': 'application/json'
        }
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`LTA API responded with status ${response.status}: ${errorText || response.statusText}`);
      }

      const data = (await response.json()) as LTAResponse;
      return data;
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  // Fetch all pages (LTA limits to 500 records per page)
  let allRecords: LTACarparkRecord[] = [];
  let skip = 0;
  const pageSize = 500;
  let odataMetadata = '';

  while (true) {
    const targetUrl = `${LTA_DATAMALL_CARPARK_URL}?$skip=${skip}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'AccountKey': accountKey,
          'Accept': 'application/json'
        }
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`LTA API responded with status ${response.status} at skip=${skip}: ${errorText || response.statusText}`);
      }

      const data = (await response.json()) as LTAResponse;
      if (data['odata.metadata']) {
        odataMetadata = data['odata.metadata'];
      }

      const records = Array.isArray(data.value) ? data.value : [];
      allRecords = allRecords.concat(records);

      if (records.length < pageSize) {
        break; // Reached end of records
      }

      skip += pageSize;

      // Safeguard against infinite loops
      if (skip > 10000) break;
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  return {
    'odata.metadata': odataMetadata,
    value: allRecords
  };
}

/**
 * Serverless / Express HTTP handler for /api/lta
 */
export default async function ltaHandler(req: Request, res: Response) {
  // Extract AccountKey from headers, query, or server-side env (never hardcoded)
  const headerKey =
    (req.headers['accountkey'] as string) ||
    (req.headers['AccountKey'] as string) ||
    (req.headers['x-account-key'] as string) ||
    (req.header && (req.header('AccountKey') || req.header('accountkey')));

  const queryKey = req.query.accountKey as string | undefined;
  const accountKey = headerKey || queryKey || process.env.LTA_ACCOUNT_KEY || process.env.LTA_API_KEY;

  if (!accountKey) {
    return res.status(401).json({
      error: 'Unauthorized - Missing LTA AccountKey',
      message: 'Provide your LTA DataMall key via request header: "AccountKey: <YOUR_LTA_KEY>" or set the LTA_ACCOUNT_KEY environment variable.',
      documentation: 'https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html',
      endpoint: LTA_DATAMALL_CARPARK_URL
    });
  }

  const skipParam = req.query.$skip ? parseInt(req.query.$skip as string, 10) : undefined;
  const fetchAll = req.query.all === 'true' || req.query.all === '1';
  const lotType = req.query.lotType as string | undefined;
  const agency = req.query.agency as string | undefined;

  try {
    const ltaData = await fetchLTACarparks({
      accountKey,
      skip: skipParam,
      fetchAll
    });

    let records = ltaData.value || [];

    // Optional filters if requested via query
    if (lotType) {
      records = records.filter(r => (r.LotType || '').toUpperCase() === lotType.toUpperCase());
    }
    if (agency) {
      records = records.filter(r => (r.Agency || '').toUpperCase() === agency.toUpperCase());
    }

    return res.status(200).json({
      success: true,
      endpoint: LTA_DATAMALL_CARPARK_URL,
      source: 'LTA DataMall (CarParkAvailabilityv2)',
      count: records.length,
      'odata.metadata': ltaData['odata.metadata'],
      value: records
    });
  } catch (error: any) {
    console.error('Error fetching LTA carpark availability:', error.message);
    const status = error.message.includes('401') ? 401 : error.message.includes('403') ? 403 : 502;
    return res.status(status).json({
      success: false,
      error: 'Failed to fetch LTA DataMall data',
      details: error.message,
      endpoint: LTA_DATAMALL_CARPARK_URL
    });
  }
}

/**
 * Web Standard Request handler for Edge / Next / serverless runtimes
 */
export async function GET(request: any) {
  const url = new URL(request.url, 'http://localhost');
  const headers = request.headers;
  const headerKey =
    typeof headers?.get === 'function'
      ? headers.get('accountkey') || headers.get('AccountKey')
      : headers?.['accountkey'] || headers?.['AccountKey'];
  const accountKey = headerKey || url.searchParams.get('accountKey') || process.env.LTA_ACCOUNT_KEY || process.env.LTA_API_KEY;

  if (!accountKey) {
    return new Response(
      JSON.stringify({
        error: 'Unauthorized - Missing LTA AccountKey',
        message: 'Provide your LTA DataMall key via request header: "AccountKey: <YOUR_LTA_KEY>" or set the LTA_ACCOUNT_KEY environment variable.'
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const skip = url.searchParams.get('$skip') ? parseInt(url.searchParams.get('$skip')!, 10) : undefined;
    const data = await fetchLTACarparks({ accountKey, skip });
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
