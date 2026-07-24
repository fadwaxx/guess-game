import { RoomState, PlayerInfo, RoomSettings, PlayerCount, RoundsMode } from './types';
const rooms = new Map<string, RoomState>();
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_EXPIRY_MS = 1000 * 60 * 60 * 3;
function generateRoomCode(): string { for (let a=0;a<100;a++){ const code=Array.from({length:5},()=>ROOM_CODE_CHARS[Math.floor(Math.random()*ROOM_CODE_CHARS.length)]).join(''); if(!rooms.has(code)) return code;} throw new Error('تعذر إنشاء رمز غرفة فريد'); }
const DEFAULT_SETTINGS: RoomSettings = { categoryId:'animals', turnDurationMs:120000, roundsMode:'unlimited', playerCount:2 };
export function createRoom(hostSocketId:string, hostName:string, token:string, playerCount:PlayerCount=2, roundsMode:RoundsMode='unlimited'):RoomState {
 const name=hostName.trim(); if(!name) throw new Error('يرجى إدخال اسم اللاعب'); const code=generateRoomCode();
 const host:PlayerInfo={id:token,socketId:hostSocketId,token,name,isHost:true,isReady:false,connected:true,score:0};
 const room:RoomState={code,status:'lobby',players:[host],settings:{...DEFAULT_SETTINGS,playerCount,roundsMode},round:null,scores:{[token]:0},createdAt:Date.now(),hostId:token,cardState:{[token]:{redAvailable:true,blueAvailable:true}},totalRoundsPlayed:0,usedItemIdsByCategory:{},matchWinnerIds:[]}; rooms.set(code,room); return room;
}
export function getRoom(code:string){return rooms.get(code.trim().toUpperCase());}
export function deleteRoom(code:string){rooms.delete(code.trim().toUpperCase());}
export function joinRoom(code:string,socketId:string,name:string,token:string):{room?:RoomState;error?:string;reconnected?:boolean}{
 const room=getRoom(code); if(!room) return {error:'الغرفة غير موجودة أو انتهت صلاحيتها'}; if(Date.now()-room.createdAt>ROOM_EXPIRY_MS){deleteRoom(code);return{error:'انتهت صلاحية هذه الغرفة'}};
 const existing=room.players.find(p=>p.token===token); if(existing){existing.socketId=socketId;existing.connected=true;existing.name=name.trim()||existing.name;return{room,reconnected:true}};
 if(room.players.length>=room.settings.playerCount) return{error:'الغرفة ممتلئة بالفعل'};
 const clean=name.trim(); if(!clean)return{error:'يرجى إدخال اسم اللاعب'}; const p:PlayerInfo={id:token,socketId,token,name:clean,isHost:false,isReady:false,connected:true,score:0}; room.players.push(p);room.scores[token]=0;room.cardState[token]={redAvailable:true,blueAvailable:true};return{room};
}
export function findRoomBySocketId(socketId:string){for(const room of rooms.values())if(room.players.some(p=>p.socketId===socketId))return room;}
export function removePlayerFromRoom(code:string,playerId:string){const room=getRoom(code);if(!room)return;room.players=room.players.filter(p=>p.id!==playerId);delete room.scores[playerId];delete room.cardState[playerId];if(!room.players.length){deleteRoom(code);return;}if(room.hostId===playerId){room.hostId=room.players[0].id;room.players.forEach((p,i)=>p.isHost=i===0);}}
export function markPlayerConnection(code:string,socketId:string,connected:boolean){const room=getRoom(code);const p=room?.players.find(x=>x.socketId===socketId);if(p)p.connected=connected;}
