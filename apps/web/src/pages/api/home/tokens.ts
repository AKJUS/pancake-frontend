import { NextApiHandler } from 'next'
import { queryTokenList } from 'edge/home/queries/queryTokenList'

async function load() {
  return queryTokenList()
}
const handler: NextApiHandler = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=60, max-age=30, stale-while-revalidate=300')
  const data = await load()
  return res.status(200).json(data)
}

export default handler
