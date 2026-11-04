export const CLASSES = {
  fighter: { name:'Đấu sĩ', hp:140, armor:15, resist:10, attack:19, power:0, speed:5.4, range:2.4, rate:1.3, capacity:5, skills:['Lướt chém','Thế thủ','Địa chấn'], cooldowns:[6,10,22] },
  tank: { name:'Hộ vệ', hp:200, armor:25, resist:18, attack:15, power:0, speed:4.6, range:2.5, rate:1, capacity:5, skills:['Húc','Khiên hộ vệ','Pháo đài'], cooldowns:[7,11,25] },
  mage: { name:'Pháp sư', hp:100, armor:5, resist:15, attack:12, power:24, speed:5.1, range:10, rate:1, capacity:5, skills:['Cầu năng lượng','Vòng trì trệ','Bão năng lượng'], cooldowns:[5,10,24] },
  ranger: { name:'Xạ thủ', hp:105, armor:8, resist:8, attack:17, power:0, speed:5.5, range:12, rate:1.7, capacity:5, skills:['Xuyên phá','Bước né','Liên thanh'], cooldowns:[6,8,25] },
};
// Prices and statistics are deliberately data-driven for balancing.
export const ITEMS = [
  ['blade','Kiếm xung lực',100,{attack:9,rate:.15},'Công +9 · tốc đánh +0,15'],
  ['claw','Găng hấp thụ',140,{attack:7,lifesteal:.15},'Công +7 · hút máu đánh thường 15%'],
  ['scope','Ống ngắm',130,{attack:6,range:2},'Công +6 · tầm đánh xa +2'],
  ['motor','Bộ tăng áp',120,{rate:.5,speed:.3},'Tốc đánh +0,5 · tốc chạy +0,3'],
  ['hammer','Búa phá giáp',160,{attack:14,penetration:12},'Công +14 · xuyên phòng thủ +12'],
  ['staff','Trượng cộng hưởng',100,{power:22,cdr:.06},'Phép +22 · giảm hồi chiêu 6%'],
  ['prism','Lăng kính',150,{power:30,penetration:12},'Phép +30 · xuyên phòng thủ +12'],
  ['coil','Cuộn ổn định',130,{power:12,cdr:.14},'Phép +12 · giảm hồi chiêu 14%'],
  ['reactor','Lò phản ứng',180,{power:40,hp:15},'Phép +40 · máu +15'],
  ['plate','Giáp hợp kim',100,{hp:35,armor:18},'Máu +35 · giáp +18'],
  ['insulator','Áo cách điện',100,{hp:30,resist:22},'Máu +30 · kháng phép +22'],
  ['heart','Tim titan',170,{hp:75,regen:1},'Máu +75 · hồi 1 máu/giây'],
  ['shell','Vỏ phản lực',140,{armor:12,resist:12,speed:.3},'Giáp +12 · kháng phép +12 · tốc chạy +0,3'],
  ['boots','Giày phản lực',110,{speed:.9,cdr:.04},'Tốc chạy +0,9 · giảm hồi chiêu 4%'],
  ['pack','Ba lô vận chuyển',100,{capacity:4,hp:20},'Sức chứa pin +4 · máu +20'],
  ['medic','Bộ tái tạo',130,{regen:2,hp:25},'Hồi 2 máu/giây · máu +25'],
  ['battery','Pin dự phòng',120,{power:10,attack:5,hp:20},'Phép +10 · công +5 · máu +20'],
  ['relay','Bộ tiếp vận',150,{capacity:2,speed:.5,armor:8},'Sức chứa +2 · tốc chạy +0,5 · giáp +8'],
].map(([id,name,price,stats,description])=>({id,name,price,stats,description}));
export const POTIONS = [
  {id:'heal',name:'Hồi phục',price:30,description:'Hồi 12 máu/giây trong 4 giây; trúng đòn sẽ ngắt.'},
  {id:'shield',name:'Lá chắn',price:35,description:'Thêm 45 khiên trong 5 giây.'},
  {id:'haste',name:'Tăng tốc',price:30,description:'Tăng 35% tốc chạy trong 4 giây.'},
];
export const BASES = [{x:-65,z:0},{x:65,z:0}];
export const WALLS = [
  {x:-7,z:-5,w:5,d:2},{x:7,z:5,w:5,d:2},
  {x:-7,z:5,w:3,d:2},{x:7,z:-5,w:3,d:2},
  {x:0,z:-11,w:7,d:2},{x:0,z:11,w:7,d:2},
];
export const PIN_SPAWNS=[{x:-40,z:-18},{x:40,z:18},{x:-38,z:22},{x:38,z:-22},{x:0,z:0},{x:-15,z:-30},{x:15,z:30},{x:-58,z:14},{x:58,z:-14}];
export const MATCH_SECONDS=600;
export const CORE_HP=750;
export const CHARGE_REQUIRED=18;
export const STAT_LABELS={hp:'Máu',armor:'Giáp',resist:'Kháng phép',attack:'Công vật lý',power:'Sức mạnh phép',rate:'Tốc đánh',range:'Tầm đánh',speed:'Tốc chạy',capacity:'Sức chứa pin',cdr:'Giảm hồi chiêu',regen:'Hồi máu/giây',lifesteal:'Hút máu',penetration:'Xuyên phòng thủ'};
