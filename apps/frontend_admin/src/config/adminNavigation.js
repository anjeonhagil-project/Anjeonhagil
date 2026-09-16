// 시안과 같은 운영 순서로 배치하며 슈퍼관리자 기능은 권한에 따라 노출한다.
import {LayoutDashboard,Users,Database,Megaphone,MessageSquare,Route,ShieldCheck} from 'lucide-react'
export const adminNavigation=[
    {label:'운영 대시보드',path:'/dashboard',icon:LayoutDashboard},
    {label:'회원 관리',path:'/members',icon:Users},
    {label:'경로 검색 기록',path:'/routes',icon:Route},
    {label:'데이터 관리',path:'/datasets',icon:Database,children:[
        {label:'성공한 경로 검색',path:'/datasets/success'},
        {label:'실패한 경로 검색',path:'/datasets/failure'},
    ]},
    {label:'공지사항',path:'/notices',icon:Megaphone},
    {label:'문의사항',path:'/inquiries',icon:MessageSquare},
    {label:'관리자 관리',path:'/admins',icon:ShieldCheck,superOnly:true},
]
