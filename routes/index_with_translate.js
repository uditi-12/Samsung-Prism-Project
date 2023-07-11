'use strict';
const router = require('express').Router();
const Razorpay = require('razorpay');

//WHATSAPP CLOUD DETAILS
const WhatsappCloudAPI = require('whatsappcloudapi_wrapper');
const Whatsapp = new WhatsappCloudAPI({
    accessToken: process.env.Meta_WA_accessToken,
    senderPhoneNumberId: process.env.Meta_WA_SenderPhoneNumberId,
    WABA_ID: process.env.Meta_WA_wabaId
});

//RAZORPAY DETAILS
const razorpay = new Razorpay({
    key_id: '<Your Key ID>',
    key_secret: '<Your Key Secret>',
});

let order_id = 0;
let method = 'Cash (At Store)';

//RAZORPAY ORDER LINK - TILL KYC
const createPaymentOrder = async (amount, currency, receipt, customer_name, customer_phone, description, notes) => {
    try {
        const options = {
            amount: amount,
            currency: currency,
            receipt: receipt,
            notes: notes,
        };

        const order = await razorpay.orders.create(options);
        const paymentLink = `https://checkout.razorpay.com/v1/payments/${order.id}`;
        return paymentLink;
    } catch (error) {
        console.error('Error creating payment order:', error);
        throw error;
    }
};

const isPaymentCompleted = async (orderId) => {
    try {
        const order = await razorpay.orders.fetch(orderId);

        if (order.status === 'paid') {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
};

//RAZORPAY PAYMENT LINK - AFTER KYC
// const createPaymentOrder = async (amount, currency, receipt, customer_name, customer_phone, description, notes) => {
//     try {
//         const options = {
//             amount: amount,
//             currency: currency,
//             description: description,
//             customer: {
//                 name: customer_name,
//                 contact: customer_phone
//             },
//             notes: {
//                 referenceId: receipt
//             },
//             callback_url: 'https://adb5-2401-4900-1cc8-2d9-b97b-1049-26c8-5133.ngrok-free.app/meta_wa_callbackurl'
//         };

//         const paymentLink = await razorpay.paymentLinks.create(options);
//         return paymentLink.short_url;

//     } catch (error) {
//         console.error('Error creating payment order:', error);
//         throw error;
//     }
// };

// const isPaymentCompleted = async (paymentLink) => {
//     try {
//         const payment = await razorpay.payments.fetch(paymentLink);
//         if (payment.status === 'captured') {
//             return true;
//         } else {
//             return false;
//         }
//     } catch (error) {
//         console.error('Error:', error);
//         return false;
//     }
// };

//Multilingual
const translate = require('translate');

async function translateString(str, flt) {
    translate.engine = 'google';
    let translateTo = "english";

    if (flt == 1)
        translateTo = "hindi";
    else
        translateTo = "english";

    const translated_string = await translate(str, translateTo);
    console.log(translated_string);
    return String(translated_string);
}

//DEFAULT FOR ENGLISH LANGUAGE
let flag = 0;

//SAMSUNG PRODUCTS
const EcommerceStore = require('../utils/samsung_store.js');
let Store = new EcommerceStore();
const CustomerSession = new Map();

//BASIC PING
router.get('/meta_wa_callbackurl', (req, res) => {
    try {
        console.log('GET: Ping!');

        let mode = req.query['hub.mode'];
        let token = req.query['hub.verify_token'];
        let challenge = req.query['hub.challenge'];

        if (
            mode &&
            token &&
            mode === 'subscribe' &&
            process.env.Meta_WA_VerifyToken === token
        ) {
            // console.log(challenge)
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    } catch (error) {
        console.error({ error })
        return res.sendStatus(500);
    }
});

//MAIN FUNCTION
router.post('/meta_wa_callbackurl', async (req, res) => {
    try {
        //DATA MESSAGE BODY
        let data = Whatsapp.parseMessage(req.body);

        if (data?.isMessage) {
            //VARIABLES EXTRACTION
            let incomingMessage = data.message;
            let recipientPhone = incomingMessage.from.phone;
            let recipientName = incomingMessage.from.name;
            let typeOfMsg = incomingMessage.type;
            let message_id = incomingMessage.message_id;

            //CART SESSION
            if (!CustomerSession.get(recipientPhone)) {
                CustomerSession.set(recipientPhone, {
                    cart: [],
                });
            }

            //ADD TO CART
            let add_cart = async ({ product_id, recipientPhone }) => {
                let product = new Array(await Store.get_product_by_id(product_id));
                CustomerSession.get(recipientPhone).cart.push(product[0]);
            };

            //LIST OF ITEMS IN CART
            let cart_items = ({ recipientPhone }) => {
                let total = 0;
                let products = CustomerSession.get(recipientPhone).cart;
                total = products.reduce(
                    (acc, product) => acc + product.price_info,
                    total
                );
                let count = products.length;
                return { total, products, count };
            };

            //CLEAR THE CART
            let clear_cart = ({ recipientPhone }) => {
                CustomerSession.get(recipientPhone).cart = [];
            };

            //IF MESSAGE = TEXT
            if (typeOfMsg === 'text_message') {
                order_id = Math.floor(Math.random() * 1000001);
                //INITIAL MESSAGE
                await Whatsapp.sendSimpleButtons({
                    message: ((await translateString(`Hey ${recipientName}, \nWelcome to Samsung Store! \n\nSelect one of the options given below 📃`, flag)).toString()),
                    recipientPhone: recipientPhone,
                    listOfButtons: [
                        {
                            title: ((await translateString('View Products 🛍️', flag)).toString()),
                            id: 'view_products',
                        },
                        {
                            title: ((await translateString('Test Message', flag)).toString()),
                            id: 'test_message',
                        },
                        {
                            title: ((await translateString('Language', flag)).toString()),
                            id: 'lang',
                        },
                    ],
                });
            }

            //IF MESSAGE = SIMPLE BUTTON
            if (typeOfMsg === 'simple_button_message') {
                let simple_button_message_id = incomingMessage.button_reply.id;

                if (simple_button_message_id === 'lang') {
                    await Whatsapp.sendSimpleButtons({
                        message: ((await translateString(`Here are some languages which are supported by our bot `, flag)).toString()),
                        recipientPhone: recipientPhone,
                        listOfButtons: [
                            {
                                title: ((await translateString('English', flag)).toString()),
                                id: 'lang_en',
                            },
                            {
                                title: ((await translateString('Hindi', flag)).toString()),
                                id: 'lang_hi'
                            },
                        ],
                    });
                }


                if (simple_button_message_id.startsWith('lang_')) {
                    let selectedlang = simple_button_message_id;
                    if (selectedlang == 'lang_en') {
                        flag = 0;
                    }
                    else if (selectedlang == 'lang_hi') {
                        flag = 1;
                    }


                    await Whatsapp.sendSimpleButtons({
                        message: ((await translateString(`Woohoo, Language succesfully converted!`, flag)).toString()),
                        recipientPhone: recipientPhone,
                        listOfButtons: [
                            {
                                title: ((await translateString('View Products 🛍️', flag)).toString()),
                                id: 'view_products',
                            },
                            {
                                title: ((await translateString('Test Message', flag)).toString()),
                                id: 'test_message',
                            },
                        ],
                    });
                }

                //TEST MESSAGE
                if (simple_button_message_id === 'test_message') {
                    await Whatsapp.sendText({
                        recipientPhone: recipientPhone,
                        message: ((await translateString(`Hey There,\nThis is a test message to let you know that the server is up and running ✅`, flag)).toString()),
                    });
                }

                //VIEW PRODUCTS 🛍️/CATEGORIES
                if (simple_button_message_id === 'view_products') {
                    // let categories = await Store.get_new_categories(); 
                    await Whatsapp.sendSimpleButtons({
                        message: ((await translateString(`Here are some Categories of our products. Have fun exploring! 🔭`, flag)).toString()),
                        recipientPhone: recipientPhone,
                        listOfButtons: [
                            {
                                title: ((await translateString('Electronics', flag)).toString()),
                                id: 'category_electronics',
                            },
                        ],
                    });
                }


                //SELECTED CATEGORY PRODUCT EXTRACTION
                if (simple_button_message_id.startsWith('category_')) {
                    let selectedCategory = simple_button_message_id.split('category_')[1];
                    // let products_list = await Store.get_products_in_category(selectedCategory);
                    let products_list = await Store.getProducts("https://www.samsung.com/in/api/v4/configurator/syndicated-product?sku=ALL&offset=5");

                    let title = ((await translateString(`🥇 Top Products in: ${selectedCategory}`.substring(0, 20), flag)).toString())
                    const rows = [];

                    products_list.map(async (product) => {
                        let id = `product_${product.sku}`.substring(0, 256);
                        let title = (await translateString(product.product_display_name.substring(0, 21), flag)).toString().substring(0, 21);
                        let description = (await translateString(`${product.price_info}\n${product.short_description}`.substring(0, 68), flag)).toString().substring(0, 60);

                        const dt = ({
                            id: id,
                            title: `${title}...`,
                            description: `₹${description}...`
                        });
                        rows.push(dt);

                    }).slice(0, 10)

                    //PRODUCT DISPLAY
                    await Whatsapp.sendRadioButtons({
                        recipientPhone: recipientPhone,
                        headerText: ((await translateString(`Selected Category: ${selectedCategory}!`, flag)).toString()),
                        bodyText: ((await translateString(`Here are some of our most famous products at the moment 🏬\n\nYou may take a look and select one of the products below:`, flag)).toString()),
                        footerText: ((await translateString('Courtesy: Samsung Store', flag)).toString()),
                        listOfSections: [{
                            title: title,
                            rows: rows
                        }],
                    });
                }

                //ADD TO CART
                if (simple_button_message_id.startsWith('add_to_cart_')) {
                    let product_id = simple_button_message_id.split('add_to_cart_')[1];
                    await add_cart({ recipientPhone, product_id });
                    let cart_quantity = cart_items({ recipientPhone }).count;

                    await Whatsapp.sendSimpleButtons({
                        message: ((await translateString(`Wohoo! The Cart has been updated 🎉\nCart Quantity:  ${cart_quantity} \n\nWhat do you want to do next?`, flag)).toString()),
                        recipientPhone: recipientPhone,
                        listOfButtons: [
                            {
                                title: ((await translateString('Checkout 💸', flag)).toString()),
                                id: `checkout`,
                            },
                            {
                                title: ((await translateString('Clear Cart ❌', flag)).toString()),
                                id: `clear_cart`,
                            },
                            {
                                title: ((await translateString('More Products 🛍️', flag)).toString()),
                                id: 'view_products',
                            },
                        ],
                    });
                }

                //BACK TO CART
                if (simple_button_message_id.startsWith('back_clear_cart')) {
                    let cart_quantity = cart_items({ recipientPhone }).count;

                    await Whatsapp.sendSimpleButtons({
                        message: ((await translateString(`Wohoo! The Cart has been restored 🎉\nCart Quantity:  ${cart_quantity} \n\nWhat do you want to do next?`, flag)).toString()),
                        recipientPhone: recipientPhone,
                        listOfButtons: [
                            {
                                title: ((await translateString('Checkout 💸', flag)).toString()),
                                id: `checkout`,
                            },
                            {
                                title: ((await translateString('Clear Cart ❌', flag)).toString()),
                                id: `clear_cart`,
                            },
                            {
                                title: ((await translateString('More Products 🛍️', flag)).toString()),
                                id: 'view_products',
                            },
                        ],
                    });
                }

                //CLEAR CART
                if (simple_button_message_id.startsWith('clear_cart')) {
                    await Whatsapp.sendSimpleButtons({
                        message: ((await translateString(`Are you sure you want to remove all items in your cart? (Cannot be undone) 👀`, flag)).toString()),
                        recipientPhone: recipientPhone,
                        listOfButtons: [
                            {
                                title: ((await translateString('Yes - Clear ✅', flag)).toString()),
                                id: 'yes_clear_cart',
                            },
                            {
                                title: ((await translateString('No - Do not Clear ❌', flag)).toString()),
                                id: 'no_clear_cart',
                            },
                            {
                                title: ((await translateString('Go Back ⬅️', flag)).toString()),
                                id: 'back_clear_cart',
                            },
                        ],
                    });
                }

                //CLEAR CART - YES
                if (simple_button_message_id.startsWith('yes_clear_cart')) {
                    await clear_cart({ recipientPhone });
                    let cart_quantity = cart_items({ recipientPhone }).count;

                    await Whatsapp.sendSimpleButtons({
                        message: ((await translateString(`Absolutely! The Cart has been cleared ✅\nCart Quantity:  ${cart_quantity} \n\nWhat do you want to do next?`, flag)).toString()),
                        recipientPhone: recipientPhone,
                        listOfButtons: [
                            {
                                title: ((await translateString('View Products 🛍️', flag)).toString()),
                                id: 'view_products',
                            },
                        ],
                    });
                }

                //CLEAR CART - NO
                if (simple_button_message_id.startsWith('no_clear_cart')) {
                    let cart_quantity = cart_items({ recipientPhone }).count;

                    await Whatsapp.sendSimpleButtons({
                        message: ((await translateString(`Got it, we aren't changing anything! ✨ \nCart Quantity:  ${cart_quantity} \n\nWhat do you want to do next?`, flag)).toString()),
                        recipientPhone: recipientPhone,
                        listOfButtons: [
                            {
                                title: ((await translateString('View Products 🛍️', flag)).toString()),
                                id: 'view_products',
                            },
                            {
                                title: ((await translateString('Checkout 💸', flag)).toString()),
                                id: `checkout`,
                            },
                            {
                                title: ((await translateString('Go Back ⬅️', flag)).toString()),
                                id: 'back_clear_cart',
                            },
                        ],
                    });
                }

                //CHECKOUT MAIN
                if (simple_button_message_id === 'checkout') {
                    await Whatsapp.sendSimpleButtons({
                        recipientPhone: recipientPhone,
                        message: ((await translateString(`How would you like to pay, ${recipientName} ?\n\n`, flag)).toString()),
                        message_id,
                        listOfButtons: [
                            {
                                title: ((await translateString('RazorPay 🌐', flag)).toString()),
                                id: 'checkout_razorpay',
                            },
                            {
                                title: ((await translateString('Cash (At Store) 💵', flag)).toString()),
                                id: 'checkout_bill',
                            },
                        ],
                    });
                }

                //CHECKOUT RAZORPAY
                if (simple_button_message_id === 'checkout_razorpay') {
                    const amount = 100;
                    const currency = 'INR';
                    const receipt = order_id;
                    const customer_name = recipientName;
                    const customer_phone = recipientPhone;
                    const description = 'Payment for Samsung Store';
                    const notes = {
                        customer_name: customer_name,
                        customer_phone: customer_phone,
                    };                      

                    const order = await createPaymentOrder(amount, currency, receipt, customer_name, customer_phone, description, notes);
                    console.log(order);
                    let razorpay_message = ((await translateString('Payment Link: ', flag)).toString() + order + ((await translateString('\n\nPlease click on the link above to complete the payment 🏦 ', flag)).toString()));

                    await Whatsapp.sendText({
                        message: razorpay_message,
                        recipientPhone: recipientPhone,
                    });

                    await Whatsapp.sendSimpleButtons({
                        recipientPhone: recipientPhone,
                        message: ((await translateString(`Once you are done with the payment, click on the following options below for confirmation ⬇️.`, flag)).toString()),
                        message_id,
                        listOfButtons: [
                            {
                                title: ((await translateString('Payment Done ✅', flag)).toString()),
                                id: 'checkout_razorpay_confirm',
                            },
                            {
                                title: ((await translateString('With Cash (Store) ❌', flag)).toString()),
                                id: 'checkout_bill',
                            },
                        ],
                    });
                }

                //CHECKOUT RAZORPAY CONFIRM
                if (simple_button_message_id === 'checkout_razorpay_confirm') {

                    await isPaymentCompleted(order_id).then((paymentCompleted) => {
                        if (paymentCompleted) {
                            method = 'Paid Online';
                        }

                        else {
                            method = 'Cash (At Store)';
                        }
                    });

                    if (method == 'Paid Online') {
                        await Whatsapp.sendSimpleButtons({
                            recipientPhone: recipientPhone,
                            message: ((await translateString(`Payment has been received ✅ Click the below button to generate invoice ⬇️.`, flag)).toString()),
                            message_id,
                            listOfButtons: [
                                {
                                    title: ((await translateString('Payment Done ✅', flag)).toString()),
                                    id: 'checkout_bill',
                                },
                            ],
                        });
                    }

                    else {
                        await Whatsapp.sendSimpleButtons({
                            recipientPhone: recipientPhone,
                            message: ((await translateString(`Payment has failed ❌ Click the below button to generate invoice and pay via Cash at the store ⬇️.`, flag)).toString()),
                            message_id,
                            listOfButtons: [
                                {
                                    title: ((await translateString('Cash Pay (Store) 💵', flag)).toString()),
                                    id: 'checkout_bill',
                                },
                            ],
                        });
                    }
                }

                //CHECKOUT BILL
                if (simple_button_message_id === 'checkout_bill') {
                    let final_amount = cart_items({ recipientPhone });
                    let bill_content = "\n*SAMSUNG WHATSAPP STORE INVOICE*\n\n"
                    bill_content += ((await translateString(`*Customer Details:*`, flag)).toString());
                    bill_content += ((await translateString(`\nName: ${recipientName}`, flag)).toString());
                    bill_content += ((await translateString(`\nPhone: ${recipientPhone}`, flag)).toString());

                    bill_content += ((await translateString(`\n\n*Products in the Cart:*\n`, flag)).toString());
                    final_amount.products.forEach((item, index) => {
                        let serial = index + 1;
                        bill_content += `\n#${serial}: ${item.product_display_name} @ Rs.${item.price_info}`;
                    });

                    bill_content += ((await translateString(`\n\n*Payment Method:* ${method}`, flag)).toString());
                    bill_content += ((await translateString(`\n\n*Total Payable Amount:* Rs. ${final_amount.total}`, flag)).toString());
                    bill_content += ((await translateString(`\n\n*Note:* You are requested to go to your nearest store and show them this invoice and collect your order. The contact details are given below: `, flag)).toString());
                    bill_content += ((await translateString(`\n\nContact Number: +91-xxxxxxxxxx\nE-Mail: xyz@samsung.com \nStore: Bangalore, India.`, flag)).toString());

                    Store.generate_pdf_bill({
                        order_details: bill_content,
                        file_path: `./invoice_${recipientName}.pdf`,
                    });

                    await Whatsapp.sendText({
                        message: bill_content,
                        recipientPhone: recipientPhone,
                    });

                    await Whatsapp.sendSimpleButtons({
                        recipientPhone: recipientPhone,
                        message: ((await translateString(`Thank you for your order, ${recipientName} 🥳\n\nYour order has been received and will be processed shortly, Please click the button below to generate your invoice ✅`, flag)).toString()),
                        message_id,
                        listOfButtons: [
                            {
                                title: ((await translateString('Generate Invoice', flag)).toString()),
                                id: 'send_bill',
                            },
                        ],
                    });

                    clear_cart({ recipientPhone });
                    order_id = 0;
                };

                //SEND BILL
                if (simple_button_message_id === 'send_bill') {
                    // Send the PDF invoice
                    await Whatsapp.sendDocument({
                        recipientPhone: recipientPhone,
                        caption: `Samsung Store | Invoice - ${recipientName}`,
                        file_path: `./invoice_${recipientName}.pdf`,
                    });

                    await Whatsapp.sendText({
                        recipientPhone: recipientPhone,
                        message: ((await translateString(`Your order is successful. Thank you for shopping with us today! ✅`, flag)).toString()),
                    });

                }
            };

            //IF MESSAGE = RADIO BUTTON
            if (typeOfMsg === 'radio_button_message') {
                let selected_radio = incomingMessage.list_reply.id;

                //PRODUCT DESCRIPTION
                if (selected_radio.startsWith('product_')) {
                    let product_id = selected_radio.split('_')[1];
                    let detailed = new Array(await Store.get_product_by_id(product_id));
                    const { sku, short_description, model_name, product_display_name, review_rating, images, color, price_info } = detailed[0];

                    let emojiRating = (rvalue) => {
                        rvalue = Math.floor(rvalue || 0); //Rating Value in whole number
                        let output = [];
                        for (var i = 0; i < rvalue; i++) output.push('⭐');
                        return output.length ? output.join('') : '⭐⭐⭐';
                    };

                    let description = `${short_description}`;
                    if (description.replace(/\s/g, "") == "") {
                        description = "No description available.";
                    }

                    let text_final = "_*The Selected Product Details are:*_\n\n";
                    text_final += `_Product Name_: *${(await translateString(product_display_name.trim(), flag)).toString()}*\n\n\n`;
                    text_final += `_Description_: ${(await translateString(description.trim(), flag)).toString()}\n\n\n`;
                    text_final += `_Price_: ₹${price_info}\n`;
                    text_final += `_Category_: ${(await translateString("Electronics", flag)).toString()}\n`;
                    text_final += `_Colors_: ${color} ${(await translateString("available.", flag)).toString()}\n`;
                    text_final += `_Rated_: ${emojiRating(review_rating)}\n`;

                    await Whatsapp.sendImage({
                        recipientPhone,
                        url: images,
                        caption: text_final,
                    });

                    //PRODUCT VIEW DECISION
                    await Whatsapp.sendSimpleButtons({
                        message: ((await translateString(`Your product has been selected ✅\nWhat would you like to do next?`, flag)).toString()),
                        recipientPhone: recipientPhone,
                        listOfButtons: [
                            {
                                title: ((await translateString('Add to cart 🛒', flag)).toString()),
                                id: `add_to_cart_${product_id}`,
                            },

                            {
                                title: ((await translateString('View More Products', flag)).toString()),
                                id: 'view_products',
                            },
                        ],
                    });
                }
            }

            //BLUE TICKS ON WHATSAPP
            await Whatsapp.markMessageAsRead({ message_id });
        }

        //LOG MESSAGE
        console.log('POST: Pinged!');
        return res.sendStatus(200);
    }

    catch (error) {
        console.error({ error })
        return res.sendStatus(500);
    }
});

module.exports = router;