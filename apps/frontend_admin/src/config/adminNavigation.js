import { LayoutDashboard, Users, Database, Megaphone, MessageSquare } from 'lucide-react'

export const adminNavigation = [
  {
    label: "운영 대시보드",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "회원 관리",
    path: "/members",
    icon: Users,
  },
  {
    label: "데이터 관리",
    path: "/datasets",
    icon: Database,
    children: [
        {
            label: "성공한 경로 검색",
            path: "/datasets/success",
        },
        {
            label: "실패한 경로 검색",
            path: "/datasets/failure",
        }
    ]
  },
  {
    label: "공지사항",
    path: "/notices",
    icon: Megaphone,
  },
  {
    label: "문의사항",
    path: "/inquiries",
    icon: MessageSquare,
  },
];