import type { Request, Response } from 'express';

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  integrations: {
    ltaDatamall: {
      endpoint: string;
      hasAccountKeyConfigured: boolean;
    };
  };
}

/**
 * Serverless health check handler
 */
export default async function healthHandler(req: Request, res: Response) {
  const hasAccountKey = Boolean(process.env.LTA_ACCOUNT_KEY || process.env.LTA_API_KEY);
  const uptime = typeof process.uptime === 'function' ? Math.floor(process.uptime()) : 0;

  const payload: HealthCheckResponse = {
    status: 'ok',
    service: 'ParkSmart SG LTA Backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: uptime,
    environment: process.env.NODE_ENV || 'development',
    integrations: {
      ltaDatamall: {
        endpoint: 'https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2',
        hasAccountKeyConfigured: hasAccountKey
      }
    }
  };

  if (res && typeof res.status === 'function') {
    return res.status(200).json(payload);
  }
  return payload;
}

/**
 * Web Standard handler for Edge / Next / serverless runtimes
 */
export async function GET() {
  const hasAccountKey = Boolean(process.env.LTA_ACCOUNT_KEY || process.env.LTA_API_KEY);
  const uptime = typeof process.uptime === 'function' ? Math.floor(process.uptime()) : 0;

  const payload: HealthCheckResponse = {
    status: 'ok',
    service: 'ParkSmart SG LTA Backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: uptime,
    environment: process.env.NODE_ENV || 'development',
    integrations: {
      ltaDatamall: {
        endpoint: 'https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2',
        hasAccountKeyConfigured: hasAccountKey
      }
    }
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
