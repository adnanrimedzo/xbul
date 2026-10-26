import { toNextJsHandler } from 'better-auth/next-js';
import { getContainer } from '@/server/container';

const handler = async () => toNextJsHandler((await getContainer()).auth);

export const GET = async (request: Request) => (await handler()).GET(request);
export const POST = async (request: Request) => (await handler()).POST(request);
