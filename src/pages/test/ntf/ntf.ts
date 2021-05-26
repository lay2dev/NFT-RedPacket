import PWCore, {
  Address,
  AddressType,
  Amount,
  BuilderOption,
  OutPoint,
} from '@lay2/pw-core'
import { getSecondaryAuth, LocalAuthInfo } from './auth-item'
import { RedPacketBuilder } from './red-packet-builder'
import { RedPacketProvider } from './red-packet-provider'
import { UnipassIndexerCollector } from './unipass-indexer-collector'
import { UnipassSigner } from './unipass-signer'
import {
  getAddressByPubkey,
  getPubkeyHash,
  rsaDep,
  acpDep,
  unipassDep,
  NODE_URL,
  INDEXER_URL,
} from './utils'

export async function transfer(
  masterPubkey: string,
  masterAuth: string,
  localAuthSig: string,
  exchangeKey: CryptoKey,
  exchangePubkey: string,
  localAuthInfo: string,
  toAddress: string,
) {
  const provider = new RedPacketProvider(
    masterPubkey,
    masterAuth,
    localAuthSig,
    exchangeKey,
    exchangePubkey,
    localAuthInfo,
  )
  const collector = new UnipassIndexerCollector(INDEXER_URL)
  const pwcore = await new PWCore(NODE_URL).init(provider, collector)
  const fromAddress = getAddressByPubkey(masterPubkey)
  console.log('fromAddress', fromAddress)
  const cells = await collector.collectAllLiveCells(
    new Address(fromAddress, AddressType.ckb),
    new Amount('10000'),
  )
  let inputCells = cells.slice(0, 4)
  const lockLen =
    (1 + (8 + 256 * 2) * 3) * 2 + localAuthInfo.replace('0x', '').length
  console.log('lockLen', lockLen)
  const options: BuilderOption = {
    witnessArgs: {
      lock: '0x' + '0'.repeat(lockLen),
      input_type: '',
      output_type: '',
    },
  }
  const builder = new RedPacketBuilder(
    new Address(toAddress, AddressType.ckb),
    inputCells,
    options,
    [rsaDep, acpDep, unipassDep],
  )
  const signer = new UnipassSigner([provider])
  const txhash = await pwcore.sendTransaction(builder, signer)
  console.log('txhash', txhash)
}

export async function authKeyX(
  masterPubkey: string,
  exchangePubkey: string[],
  localPubkey: string,
) {
  const collector = new UnipassIndexerCollector(INDEXER_URL)
  const fromAddress = getAddressByPubkey(masterPubkey)
  console.log('fromAddress', fromAddress)
  const cells = await collector.collectAllLiveCells(
    new Address(fromAddress, AddressType.ckb),
    new Amount('10000'),
  )
  let inputCells = cells.slice(0, 4)
  const localAuth: LocalAuthInfo = []
  for (let item of exchangePubkey) {
    const data = {
      pubkeyHash: getPubkeyHash(item),
      outpoints: inputCells.map((x) => x.outPoint as OutPoint),
    }
    localAuth.push(data)
  }
  const { authInfo, authSig } = await getSecondaryAuth(localPubkey, localAuth)
  return { authInfo, authSig }
}
