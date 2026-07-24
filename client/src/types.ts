export interface GameItem { id:string; categoryId:string; nameAr:string; nameEn:string; aliasesAr:string[]; aliasesEn?:string[]; imageUrl:string; emoji:string; attributes:string[]; }
export interface GameCategoryLight { id:string; nameAr:string; nameEn:string; icon:string; }
export interface PlayerInfo { id:string; name:string; isHost:boolean; isReady:boolean; connected:boolean; score:number; }
export type RoomStatus='lobby'|'settings'|'playing'|'roundEnd'|'matchEnd';
export type RoundsMode='unlimited'|30|45; export type PlayerCount=2|3|4;
export interface RoomSettings { categoryId:string; turnDurationMs:number; roundsMode:RoundsMode; playerCount:PlayerCount; }
export interface PlayerCardState { redAvailable:boolean; blueAvailable:boolean; }
export interface PublicRoundState { roundNumber:number; currentTurnPlayerId:string; targetPlayerId:string|null; turnEndsAt:number; winnerPlayerId:string|null; revealed:boolean; opponentItemForMe:GameItem|null; revealedItems?:{[playerId:string]:GameItem}; blueActivePlayerId:string|null; blueTurnsLeftIncludingCurrent:number; }
export interface PublicRoomState { code:string; status:RoomStatus; players:PlayerInfo[]; settings:RoomSettings; scores:{[playerId:string]:number}; round:PublicRoundState|null; cardState:{[playerId:string]:PlayerCardState}; totalRoundsPlayed:number; matchWinnerIds:string[]; }
