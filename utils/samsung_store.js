'use strict';
const request = require('request');
const PDFDocument = require('pdfkit');
const fs = require('fs');

let dict = []
let final_products = []
let detailed = []
let product = []

async function getResponse(url) {
  const { default: fetch } = await import('node-fetch');
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

async function getProductCodes(url) {
  const response = await fetch(url);
  const data = await response.json();
  const productCodes = data.products || [];
  return productCodes;
}

function obtainResults(dict) {
  try {
    const nonKeys = ['preferred_finance_plan', 'store_discount', 'size', 'variants', 'diagonal_screen_size', 'model_code', 'long_description', 'number_of_reviews', 'sku_source', 'flags', 'child_skus', 'child_item_groups', 'is_student_tariff', 'is_top_tariff', 'sim_sku', '5g_sim_sku', 'partner_attributes', 'redirect_url', 'delivery_group', 'warranty_text', 'usp_text', 'shipping_weight', 'family_id', 'product_type', 'related_models', 'taxonomy', 'urls', 'serial_number', 'localized_fields', 'localized_values', 'required_additional_info', 'labels', 'custom_properties', 'fulfillment_sku', 'fulfillment_skus', 'return_window', 'display', 'search_keyword', 'top_flag', 'top_flag_period_from', 'top_flag_period_to', 'nerp_model_codes', 'should_discount_exchange_value', 'pvi_product_type_name', 'pvi_product_type_code', 'pvi_product_sub_type_name', 'pvi_product_sub_type_code', 'carrier_attributes', 'promotions', 'inventory'];
    nonKeys.forEach(key => {
      if (dict.hasOwnProperty(key)) {
        delete dict[key];
      }
    });
    dict.price_info = dict.price_info[0].sale_price.value;
    dict.images = dict.images.large_image.url;
    return dict;
  } catch (error) {
    console.error(error);
    return null;
  }
}

module.exports = class EcommerceStore {
  constructor() {}

  async getProducts(url) {
    try {
      const productCodes = await getProductCodes(url);
      if (productCodes.length > 0) {
        for (let i = 0; i < productCodes.length; i++) {
          const code = obtainResults(productCodes[i]);
          if (code) {
            // console.log(code);
            dict.push(code);
          }
        }
      } else {
        console.log("No product codes found.");
      }
    } catch (error) {
      console.error(error);
    }

    final_products = dict.slice(0,10);
    // console.log(final_products);
    return final_products;
  }

  async get_product_by_id(productId) {
    const url = `https://www.samsung.com/in/api/v4/configurator/syndicated-product?sku=${productId}`
    try {
      const productCodes = await getProductCodes(url);
      if (productCodes.length > 0) {
        for (let i = 0; i < productCodes.length; i++) {
          const code = obtainResults(productCodes[i]);
          if (code) {
            product[0] = code;
          }
        }
      } else {
        console.log("No product codes found.");
      }
    } catch (error) {
      console.error(error);
    }

    return(product[0])
    // console.log(product[0]);
  }

  generate_pdf_bill({ order_details, file_path }) {
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(file_path));
    doc.fontSize(20);
    doc.text(order_details, 100, 100);
    doc.end();
    return;
  }
};