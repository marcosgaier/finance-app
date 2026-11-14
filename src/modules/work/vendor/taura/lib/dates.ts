export const toIsoDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const fromIsoDate=(value:string)=>{const[y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d)};
export const addDays=(date:Date,days:number)=>{const value=new Date(date);value.setDate(value.getDate()+days);return value};
export const startOfWorkWeek=(date:Date,weekStartsOn:number)=>{const value=new Date(date);const distance=(value.getDay()-weekStartsOn+7)%7;value.setDate(value.getDate()-distance);value.setHours(0,0,0,0);return value};
export const sameDay=(a:Date,b:Date)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
export const formatDate=(value:string,options:Intl.DateTimeFormatOptions={day:'numeric',month:'short'})=>new Intl.DateTimeFormat('es-NZ',options).format(fromIsoDate(value));
