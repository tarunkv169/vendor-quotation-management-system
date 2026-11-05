import { Lock } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/common/Button';

export default function AccessDeniedPage() {
  return (
    <div className="card mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={Lock}
        title="Access denied"
        description="Your role does not have access to this page. Contact your administrator if you need it."
        action={<Button to="/dashboard">Go to dashboard</Button>}
      />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="card mx-auto mt-10 max-w-lg">
      <EmptyState title="Page not found" description="The page you are looking for does not exist." action={<Button to="/dashboard">Go to dashboard</Button>} />
    </div>
  );
}
