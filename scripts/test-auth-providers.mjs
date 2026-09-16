import{chromium}from'playwright';import{writeFileSync}from'node:fs'
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
const results=[]
try{
    for(const [provider,label,host]of [['kakao','카카오로 로그인','accounts.kakao.com'],['google','구글로 로그인','accounts.google.com'],['naver','네이버로 로그인','nid.naver.com']]){
        const page=await browser.newPage()
        await page.goto('http://localhost:5173/login')
        await page.getByRole('button',{name:label,exact:true}).click()
        try{await page.waitForURL(url=>url.hostname===host,{timeout:20000});results.push({provider,authorization_page_reached:true,account_consent_completed:false})}
        catch{results.push({provider,authorization_page_reached:false,host:new URL(page.url()).hostname,error_text:(await page.locator('body').innerText()).slice(0,350)})}
        await page.close()
    }
}finally{await browser.close()}
writeFileSync('.test-tools/auth-provider-report.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2))
