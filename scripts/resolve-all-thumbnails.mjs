import fs from 'node:fs/promises'
const files=(await fs.readdir('data')).filter(f=>/^cards-\d+\.js$/.test(f)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
const cards=[]
for(const file of files){
  const text=await fs.readFile(`data/${file}`,'utf8')
  const json=text.slice(text.indexOf('concat(')+7,text.lastIndexOf(');'))
  cards.push(...JSON.parse(json))
}
let map={}
try{map=JSON.parse((await fs.readFile('data/thumbnails.js','utf8')).replace(/^window\.CARDBORN_THUMBNAILS=/,'').replace(/;\s*$/,''))}catch{}
const placeholder='https://t4.rbxcdn.com/180DAY-92f01c392ee9a79829852ac02d3fb15a'
for(const [id,url] of Object.entries(map))if(!url||url===placeholder)delete map[id]
const aid=s=>(String(s||'').match(/\d+/)||[''])[0]
const ids=[...new Set(cards.flatMap(c=>[aid(c.croppedImageId),aid(c.imageId)]).filter(Boolean))]
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
for(let i=0;i<ids.length;i+=20){
  const chunk=ids.slice(i,i+20),params=new URLSearchParams({assetIds:chunk.join(','),returnPolicy:'PlaceHolder',size:'420x420',format:'Png',isCircular:'false'})
  for(let attempt=0;attempt<4;attempt++){
    try{
      const res=await fetch(`https://thumbnails.roblox.com/v1/assets?${params}`,{headers:{Accept:'application/json'}})
      if(res.ok){
        const rows=(await res.json()).data||[]
        for(const row of rows)if(row?.imageUrl&&row.imageUrl!==placeholder)map[String(row.targetId)]=row.imageUrl
        break
      }
    }catch{}
    await sleep(350*(attempt+1))
  }
  await sleep(120)
}
const covered=cards.filter(c=>[aid(c.croppedImageId),aid(c.imageId)].filter(Boolean).some(id=>map[id])).length
await fs.writeFile('data/thumbnails.js',`window.CARDBORN_THUMBNAILS=${JSON.stringify(map,null,2)};\n`)
console.log(`STATIC_IMAGE_COVERAGE ${covered}/${cards.length}`)
console.log(`STATIC_MAP_ENTRIES ${Object.keys(map).length}`)
