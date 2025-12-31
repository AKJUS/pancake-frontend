const VERSION = '0.0.32'
// https://unpkg.com/@layerzerolabs/x-pancakeswap-widget@0.0.21/element.mjs.sha384
const SHA384 = 'uOc5l+SylwfIfjw4KCP4Zem7yYq4x/XwnTQA8x2dHOtBM6aBFOJzliZQJPX296Fm'

export const LAYER_ZERO_JS = {
  src: `layerzero_js.mjs`,
  css: `https://unpkg.com/@layerzerolabs/x-pancakeswap-widget@${VERSION}/element.css`,
  integrity: `sha384-${SHA384}`,
}

export const PARTNER_ID = 0x0002
export const FEE_COLLECTOR = '0x68C7ABB8b1c3D1cE467E28265770F3a7ECF32654'
export const FEE_TENTH_BPS = '0'
