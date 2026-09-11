import { requireOwner } from '@/lib/auth/guard';
import { IntroductionForecastWorkspace } from './introduction-forecast-workspace';

export const dynamic = 'force-dynamic';

export default async function IntroductionForecastPage() {
  await requireOwner();
  return <IntroductionForecastWorkspace />;
}
