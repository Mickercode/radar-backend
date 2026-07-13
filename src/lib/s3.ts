import { S3Client, PutObjectCommand, GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';

const BUCKET = process.env.S3_PODCAST_BUCKET ?? 'radar-podcasts-cache';
const REGION  = process.env.AWS_REGION ?? 'us-east-1';
const KEY     = 'podcasts/live-episodes.json';

const s3 = new S3Client({ region: REGION });

export interface S3PodcastEpisode {
  id: string;
  type: 'podcast';
  title: string;
  source: string;
  topic: string;
  duration: number;
  audioUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
  summary: undefined;
}

export async function writePodcastCache(episodes: S3PodcastEpisode[]): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: KEY,
    Body: JSON.stringify({ updatedAt: new Date().toISOString(), episodes }),
    ContentType: 'application/json',
  }));
}

export async function readPodcastCache(): Promise<S3PodcastEpisode[] | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
    const body = await res.Body?.transformToString();
    if (!body) return null;
    const parsed = JSON.parse(body) as { updatedAt: string; episodes: S3PodcastEpisode[] };
    return parsed.episodes ?? null;
  } catch (e) {
    if (e instanceof NoSuchKey) return null;
    // Any other S3 error (permissions, network) — return null so caller falls back
    return null;
  }
}
