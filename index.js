const telegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const midtransClient = require('midtrans-client')

dotenv.config({ path: '.env' });
const token = process.env.API_KEY;

const bot = new telegramBot(token, { polling: true });
let cart = []

let snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.SERVER_KEY,
    clientKey: process.env.CLIENT_KEY
});


bot.onText(/\/start/, (msg) => {
	bot.sendMessage(
		msg.chat.id,
        `Hai ${msg.from.first_name},\nSelamat datang di Sandhipracoyo online shop. 
        \nKirim /menu untuk melihat menu command yang tersedia`,
		{
			parse_mode: 'Markdown'
		}
	);
});

bot.onText(/\/menu/, (msg) => {
	bot.sendMessage(
		msg.chat.id,
		`Berikut adalah daftar menu/command : 
        \n/menu - melihat daftar menu atau command\n/product - melihat daftar product\n/profil - melihat profil anda\n/checkout - checkout`
	);
});

bot.onText(/\/profil/, async (msg)=>{
    const id = msg.from.id
    try {
        const response = await axios.get(`https://sandypracoyo-backendonlineorder.glitch.me/customer/${id}`)
        bot.sendMessage(msg.chat.id, `Berikut profil anda : \nNama : ${response.data.data.full_name} \nUsername: ${response.data.data.username}\nEmail: ${response.data.data.email}\nPhone number: ${response.data.data.phone_number}.`, {
            parse_mode:'Markdown'
        })
    } catch (error) {
        console.log(error);
        bot.sendMessage(msg.chat.id, `Maaf, anda belum terdaftar.\nSilahkan mendaftar dengan mengirimkan data dengan format berikut : \n/daftar *nama*-*username*-*email*-*phone number*\nContoh : /daftar *john doe*-*john*-*john@gmail.com*-*09123232*`,{
            parse_mode:"Markdown"
        })
    }
})

bot.onText(/\/daftar (.+)/, async (msg, data)=>{

    const [full_name,username,email,phone_number] = data[1].split('-')
    try {
       const response = await axios.post('https://sandypracoyo-backendonlineorder.glitch.me/customer/',{
           "data": {
                "attributes": {
                    "id": msg.from.id,
                    "full_name": full_name,
                    "username": username,
                    "email": email,
                    "phone_number": phone_number
                }
           }
       })
       bot.sendMessage(msg.chat.id, 'Pendaftaran berhasil, kirim /checkout untuk melanjutkan transaksi, atau kirim /profil untuk melihat profil anda')
    } catch (error) {
        console.log(error);
        bot.sendMessage(msg.chat.id, 'Anda sudah terdaftar, kirim /profil, untuk melihat profil anda')
    }
})

bot.onText(/\/product/, async (msg)=>{

    try {
        const response = await axios.get('https://sandypracoyo-backendonlineorder.glitch.me/product');
        const data = response.data.data;
        bot.sendMessage(msg.chat.id, 'List Product')
        data.forEach(e => {
            bot.sendMessage(
              msg.chat.id,
              `*Nama*: ${e.name}
*Harga*: ${e.price}
        `,{
            "reply_markup": {
                "inline_keyboard": [
                    [
                        {
                            text: "Add to cart",
                            callback_data: e.id,
                        },
                    ],
                ],
            }, parse_mode:"Markdown"}
            );
          });
        bot.sendMessage(msg.chat.id,'Setelah selesai memilih produk, silahkan melakukan /checkout untuk pembayaran')
    } catch (error) {
        console.log(error);
    }
})

bot.on("callback_query", function onCallbackQuery(callbackQuery) {
    const action = parseInt(callbackQuery.data)
    const msg = callbackQuery.message
    const [nama,harga] = callbackQuery.message.text.split('\n')
    const name = nama.replace('Nama: ','')
    const price = harga.replace('Harga: ','')
    const newPrice = parseInt(price)

    const opts = {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode:'markdown'
      };
    const data = {
        "product_id": action,
        "name": name,
        "price": newPrice,
        "quantity": 1
    }
   cart.push(data)
   bot.editMessageText(`${name} berhasil ditambahkan ke cart !`, opts)
});

bot.onText(/\/checkout/, async (msg)=>{
    const id = msg.from.id
    try {
        const respon = await axios.get(`https://sandypracoyo-backendonlineorder.glitch.me/customer/${id}`)
        const profil = respon.data
            if(cart.length>0){
                const response = await axios.post('https://sandypracoyo-backendonlineorder.glitch.me/order/',{
                    "data": {
                        "attributes": {
                            "user_id": msg.from.id,
                            "order_detail": cart
                        }
                      }
                })
                let subtotal = []
                cart.forEach(e => {
                    subtotal.push(e.quantity*e.price)
                });
                let total = subtotal.reduce((a,b)=>a+b)
                let parameter = {
                    transaction_details: {
                      order_id: `test-transaction-${Date.now()}`,
                      gross_amount: total
                    },
                    credit_card: {
                      secure: true
                    }
                  };
                
                  const transaction = await snap.createTransaction(parameter);

                bot.sendMessage(msg.chat.id, `Hai ${msg.from.first_name}, berikut adalah pesanan anda`)
                cart.forEach((e) => {
                    bot.sendMessage(msg.chat.id, `- ${e.name}
    Rp. ${e.price*e.quantity}`)
                });
                bot.sendMessage(msg.chat.id, `------------------------------
*Total* = *Rp. ${total}*`,{
                    parse_mode:'Markdown'
                })
                bot.sendMessage(msg.chat.id, `Untuk melakukkan pembayaran, silahkan kunjungi ${transaction.redirect_url}`,);
                cart = []
            }else{
                bot.sendMessage(msg.chat.id, 'Anda belum memilih product. Silahkan kirim /product untuk melihat dan memilih product.')
            }
    } catch (error) {
        console.log(error);
        bot.sendMessage(msg.chat.id, `Maaf, anda belum terdaftar. 
Silahkan mendaftar dengan mengirimkan data dengan format berikut : 
/daftar *nama*-*username*-*email*-*phone number*
        
Contoh : /daftar *john doe*-*john*-*john@gmail.com*-*09123232*`,{
                    parse_mode:"Markdown"
                })
    }
})

bot.onText(/\/history/, async(msg)=>{
    const id = msg.from.id
    try {
        const respon = await axios.get(`https://sandypracoyo-backendonlineorder.glitch.me/orderdetail/${id}`)
        const data = respon.data.data
        data.forEach((e) => {
            bot.sendMessage(msg.chat.id,`${e.id}`)
        })
        console.log(i);
    } catch (error) {
        console.log(error);
    }
})

