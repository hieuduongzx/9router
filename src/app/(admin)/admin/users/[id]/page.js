import UserDetailsPage from "@/app/(dashboard)/dashboard/users/[id]/page";

// Forward `params` — the original page awaits it server-side.
export default function AdminUserDetailPage(props) {
  return <UserDetailsPage {...props} />;
}
