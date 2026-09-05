// # 기능: 관리자 React Web 진입점
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "@fontsource-variable/geist"
import "pretendard/dist/web/variable/pretendardvariable.css"

import App from './App.jsx'
import './styles/global.css'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>
)
