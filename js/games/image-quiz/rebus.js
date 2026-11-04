// Original comic-rebus puzzle bank: short visual scenes evoke an idiom or a
// funny interpretation, rather than simply showing an object to name.
// Every prompt is hand-authored; no external image license or runtime API required.
// Format: answer|scene panel 1~panel 2~panel 3|category|difficulty
const RAW_REBUS = `đầu voi đuôi chuột|🐘🎩~✂️🧵~🐭🌀|Thành ngữ|hard
ếch ngồi đáy giếng|🌞🌏~🕳️🐸~👀❓|Thành ngữ|medium
cưỡi ngựa xem hoa|🐎🏇~👀🔍~🌹🌷|Thành ngữ|medium
nước đến chân mới nhảy|🌊📈~🦶😰~🦘💨|Thành ngữ|hard
ăn cháo đá bát|🥣😋~🦶💥~🥣🤕|Thành ngữ|medium
nước đổ đầu vịt|🚿💦~🦆🧠~😶‍🌫️|Thành ngữ|medium
đàn gảy tai trâu|🎸🎶~🐃👂~😴💤|Thành ngữ|hard
mèo mù vớ cá rán|🐈🙈~🫳❓~🐟🍳|Thành ngữ|hard
được voi đòi tiên|🐘🎁~😒💭~🧚‍♀️✨|Thành ngữ|hard
đứng núi này trông núi nọ|⛰️🧍~👀🔭~🏔️🌈|Thành ngữ|hard
cá lớn nuốt cá bé|🐟👑~😱~🐠💨|Thành ngữ|medium
ngậm đắng nuốt cay|🍋😖~🌶️🥵~🤐💦|Thành ngữ|hard
nhất cử lưỡng tiện|✋1️⃣~🎯🎯~✅✅|Thành ngữ|hard
bắt cá hai tay|🐟🤲~😏~🤲🐟|Thành ngữ|medium
đem con bỏ chợ|👶🍼~🏪🛒~🚶💨|Thành ngữ|hard
giấu đầu hở đuôi|🫣🐈~🧳📦~🐈〰️|Thành ngữ|hard
nằm mơ giữa ban ngày|☀️🕛~😴🛌~💭🦄|Thành ngữ|medium
há miệng chờ sung|😮🛏️~🌳🍈~⏳😪|Thành ngữ|hard
đẽo cày giữa đường|🪵🪚~🛣️🚗~🗣️🗣️|Thành ngữ|hard
vắt cổ chày ra nước|🪵🤏~💦❓~😱🪣|Thành ngữ|hard
lửa gần rơm lâu ngày cũng bén|🔥❤️~🌾⏳~💞✨|Tục ngữ|hard
có mới nới cũ|📱✨~📱🕸️~🗑️👋|Thành ngữ|hard
trâu buộc ghét trâu ăn|🐃🔒~😤👀~🐃🌾|Tục ngữ|hard
thùng rỗng kêu to|🪣🫙~🔊📣~😵💥|Thành ngữ|hard
ếch chết tại miệng|🐸🗣️~💬💣~🪦😶|Thành ngữ|hard
ngưu tầm ngưu mã tầm mã|🐂🤝🐂~🐎🤝🐎~🙌|Thành ngữ|hard
một nắng hai sương|☀️1️⃣~🌫️2️⃣~👩‍🌾🥵|Thành ngữ|hard
tay làm hàm nhai|✋🔨~🍚👄~✅💪|Tục ngữ|hard
ăn không ngồi rồi|🍔😋~🪑😎~🕰️💤|Thành ngữ|medium
nói một đằng làm một nẻo|🗣️⬅️~👣➡️~🤷💫|Thành ngữ|hard
đường mật chết ruồi|🍯💖~🪰😋~💀⚠️|Thành ngữ|hard
gậy ông đập lưng ông|👴🦯~↪️💥~😖👴|Thành ngữ|hard
treo đầu dê bán thịt chó|🐐📢~🏪🛒~🐕🥩|Thành ngữ|hard
ăn cây nào rào cây ấy|🍎🌳~🛡️🪚~🌲🔒|Thành ngữ|hard
con sâu làm rầu nồi canh|🍲😋~🐛⬇️~🤢😱|Thành ngữ|medium
chó ngáp phải ruồi|🐕🥱~🪰💨~😳🎉|Thành ngữ|hard
đánh trống bỏ dùi|🥁🥁~🥢✋~🏃💨|Thành ngữ|hard
rước voi về giày mả tổ|🐘🎉~🏡🌸~💥😱|Thành ngữ|hard
đầu tắt mặt tối|💡❌~😵‍💫🌚~🕰️⚡|Thành ngữ|hard
mất bò mới lo làm chuồng|🐄💨~😱🔨~🏚️🔒|Tục ngữ|medium
lên voi xuống chó|🐘⬆️~🎢🎡~🐕⬇️|Thành ngữ|medium
có công mài sắt có ngày nên kim|🔩🪨~⌛💦~🪡✨|Tục ngữ|hard
chín bỏ làm mười|9️⃣🤔~🤝➕~🔟😎|Thành ngữ|hard
ba chìm bảy nổi|3️⃣🌊⬇️~7️⃣🛟⬆️~😵‍💫🚣|Thành ngữ|hard
một cổ hai tròng|🧍👤~🔗🔗~😓💢|Thành ngữ|hard
múa rìu qua mắt thợ|🪓🕺~👷‍♂️👀~😬💥|Thành ngữ|hard
vẽ rắn thêm chân|🐍🎨~🦶🦶~🤦‍♂️❌|Thành ngữ|hard
mượn gió bẻ măng|💨🌬️~🎋🌱~🫳😏|Thành ngữ|hard
quýt làm cam chịu|🍊😈~⚖️❗~🍊😭|Thành ngữ|hard
ngậm bồ hòn làm ngọt|🫒😖~🤐😬~🍬👍|Thành ngữ|hard
đi đêm lắm có ngày gặp ma|🌙🚶~🌙🚶~👻😱|Tục ngữ|medium
một giọt máu đào hơn ao nước lã|🩸❤️~⚖️~💧🏞️|Tục ngữ|hard
được đằng chân lân đằng đầu|🦶🤝~✋⬆️~😤💥|Thành ngữ|hard
chạy trời không khỏi nắng|🏃💨~☀️☀️~🥵🤦|Thành ngữ|medium
lá lành đùm lá rách|🍃✨~🤲🩹~🍂🥺|Tục ngữ|hard
góp gió thành bão|🌬️🌬️~➕➕~🌪️💥|Thành ngữ|medium
một con ngựa đau cả tàu bỏ cỏ|🐎🤒~🐎🐎🐎~🌿🚫|Tục ngữ|hard
cơm không lành canh không ngọt|🍚💔~🍜😠~💢👫|Thành ngữ|hard
nồi nào úp vung nấy|🍲❓~🤲🫕~💞✅|Tục ngữ|medium
cõng rắn cắn gà nhà|🐍🎒~🏡🐔~😱💥|Thành ngữ|hard
kiến tha lâu đầy tổ|🐜🐜~🧱⏳~🏠✨|Tục ngữ|medium
tay trắng làm nên|✋⬜~🛠️💪~🏡✨|Thành ngữ|hard
đứng mũi chịu sào|⛵🌊~🧍🪵~🌪️😤|Thành ngữ|hard
rồng đến nhà tôm|🐉👑~🚪🔔~🦐😳|Thành ngữ|hard
được ăn cả ngã về không|🎰🎲~🏆🍰~🕳️0️⃣|Thành ngữ|hard
chưa thấy quan tài chưa đổ lệ|😎🤷~⚰️⚠️~😭💦|Thành ngữ|hard
há miệng mắc quai|😮👄~🪝💥~😫🔒|Thành ngữ|hard
ôm cây đợi thỏ|🌳🫂~⏳🕰️~🐇💨|Thành ngữ|hard
gần mực thì đen gần đèn thì sáng|🖋️⬛~💡✨~🧍🎨|Tục ngữ|hard
trong chăn mới biết chăn có rận|🛏️😴~🪳👀~😖💥|Tục ngữ|hard
khôn nhà dại chợ|🏡🧠~🏪😵~🤦‍♀️💢|Thành ngữ|hard
tức nước vỡ bờ|🌊📈~🏞️🧱~💥😱|Thành ngữ|medium
cưỡi hổ khó xuống|🐅🏇~⬇️❌~😰🤯|Thành ngữ|hard
vỏ quýt dày có móng tay nhọn|🍊🛡️~💅⚡~💥😮|Tục ngữ|hard
làm ơn mắc oán|🤝🎁~😡💢~😢💔|Thành ngữ|hard
đếm cua trong lỗ|🦀🕳️~🔢🧮~💰❓|Thành ngữ|hard
được nước lấn tới|💧✅~📈👣~😈😏|Thành ngữ|hard
có tật giật mình|😬🔒~🔔❗~😱💦|Thành ngữ|medium
đứng ngồi không yên|🧍💦~🪑🔄~😵‍💫💭|Thành ngữ|medium
cười ra nước mắt|🤣🤣~💧💧~🥲😳|Thành ngữ|medium
chân trong chân ngoài|🦶🏠~🚪👀~🦶🌳|Thành ngữ|hard
đi guốc trong bụng|🥿👣~🩺👀~🫃❓|Thành ngữ|hard
mặt dày mày dạn|😐🛡️~💢🗣️~😎✨|Thành ngữ|hard
tránh vỏ dưa gặp vỏ dừa|🍉🚫~🏃‍♂️💨~🥥💥|Thành ngữ|hard
chưa học bò đã lo học chạy|👶🧎~🏃💨~🤕🤦|Thành ngữ|hard
ăn quả nhớ kẻ trồng cây|🍎😋~🌳👩‍🌾~❤️🙏|Tục ngữ|medium
uống nước nhớ nguồn|💧🥤~🏞️⛰️~❤️🙏|Tục ngữ|medium
nói có sách mách có chứng|🗣️💬~📚📖~🧾✅|Thành ngữ|hard
sống ảo|📱🤳~✨👑~🛌😴|Đố mẹo|medium
đi vào lòng đất|🚶‍♂️⬇️~🌍🕳️~😵‍💫💥|Đố mẹo|hard
đầu óc trên mây|🧠☁️~🪁🛫~🙄💭|Đố mẹo|medium
tim đập chân run|❤️🥁~🦵〰️~😱😨|Đố mẹo|medium
đổi trắng thay đen|⚪🎨~↔️🎭~⚫😏|Thành ngữ|hard
nước chảy đá mòn|💧💧~🪨⌛~🕳️✨|Tục ngữ|medium
có chí thì nên|🧠🔥~🏔️⛰️~🏆✨|Tục ngữ|hard
khẩu phật tâm xà|🙏😇~❤️🩻~🐍😈|Thành ngữ|hard
bụng bảo dạ|🫃💭~🧠👂~🤫🤔|Thành ngữ|hard
ném đá giấu tay|🪨💨~🙈✋~😇❓|Thành ngữ|medium
qua cầu rút ván|🌉🚶~🪵💨~😰🌊|Thành ngữ|hard
ăn xổi ở thì|🍌🍔~⏱️🏚️~😎💨|Thành ngữ|hard
chó cắn áo rách|🐕💢~👕🕳️~😭🌧️|Thành ngữ|medium
ngồi mát ăn bát vàng|🌴😎~🥣✨~🥇💰|Thành ngữ|hard
con nhà lính tính nhà quan|🪖🏠~👶🧠~👑🏰|Thành ngữ|hard
điếc không sợ súng|🙉🙉~🔫💥~😎❓|Thành ngữ|hard
đổ thêm dầu vào lửa|🔥😡~🛢️💦~💥🌋|Thành ngữ|medium
thả con tép bắt con tôm|🦐🤏~🌊🎣~🦞🏆|Thành ngữ|hard
đổi gió|🏙️😮‍💨~🌬️🌴~😎✨|Đố mẹo|medium
vừa ăn cướp vừa la làng|🥷💰~📢😱~👥❗|Thành ngữ|hard
ngậm miệng ăn tiền|🤐👄~💵💰~😎🤝|Thành ngữ|medium
sáng nắng chiều mưa|🌅☀️~🕒🌧️~😵‍💫☂️|Thành ngữ|medium
đánh rắn động cỏ|🐍🥢~🌿💥~🐾🏃|Thành ngữ|hard
ngồi trên đống lửa|🪑🧍~🔥🔥~🥵😰|Thành ngữ|medium`;

export const REBUS_QUESTIONS = RAW_REBUS.trim().split("\n").map((line, index) => {
  const [answer, panels, category, difficulty] = line.split("|");
  return {
    id: "rebus-" + String(index + 1).padStart(3, "0"),
    answer: answer.trim(),
    scene: panels.split("~").map((part) => part.trim()),
    category: category.trim(),
    difficulty: difficulty.trim(),
    aliases: [],
  };
});
