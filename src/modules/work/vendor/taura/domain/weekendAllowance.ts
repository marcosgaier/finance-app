const HOUR_MS=3_600_000;

const startOfDay=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate());
const atHour=(date:Date,hour:number)=>new Date(date.getFullYear(),date.getMonth(),date.getDate(),hour);

export function calculateWeekendEligibleHours(startValue:string|null,endValue:string|null,effectiveFrom:string,paidHours?:number):number {
  if(!startValue||!endValue)return 0;
  const start=new Date(startValue),end=new Date(endValue),effective=new Date(`${effectiveFrom}T00:00:00`);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||!Number.isFinite(effective.getTime()))return 0;
  let eligibleMs=0;
  for(let day=startOfDay(start);day<end;day=new Date(day.getFullYear(),day.getMonth(),day.getDate()+1)){
    const dayOfWeek=day.getDay();
    let windowStart:Date|undefined,windowEnd:Date|undefined;
    if(dayOfWeek===5){windowStart=atHour(day,18);windowEnd=new Date(day.getFullYear(),day.getMonth(),day.getDate()+1)}
    else if(dayOfWeek===6||dayOfWeek===0){windowStart=day;windowEnd=new Date(day.getFullYear(),day.getMonth(),day.getDate()+1)}
    else if(dayOfWeek===1){windowStart=day;windowEnd=atHour(day,6)}
    if(!windowStart||!windowEnd)continue;
    const overlapStart=Math.max(start.getTime(),windowStart.getTime(),effective.getTime()),overlapEnd=Math.min(end.getTime(),windowEnd.getTime());
    if(overlapEnd>overlapStart)eligibleMs+=overlapEnd-overlapStart;
  }
  const rawHours=eligibleMs/HOUR_MS;
  return Math.max(0,paidHours==null?rawHours:Math.min(rawHours,paidHours));
}

export const calculateWeekendAllowance=(eligibleHours:number,rate:number)=>Math.round((eligibleHours*rate+Number.EPSILON)*100)/100;
