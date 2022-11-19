import React, { ChangeEvent, FC, useCallback, useEffect, useState } from 'react'
import {
  Box,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  Stack,
  FormLabel,
  Input,
  Textarea,
  DrawerFooter,
  Button,
  NumberInput,
  NumberInputField,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInputStepper,
  InputGroup,
  InputLeftAddon,
  useToast,
  useColorModeValue,
  Select,
  Image,
  HStack,
  Spinner
} from '@chakra-ui/react'
import { constants, utils } from 'ethers'
import { useContractWrite, usePrepareContractWrite, useWaitForTransaction, useAccount, useNetwork } from 'wagmi'
import { useDropzone } from 'react-dropzone'
import { useDebounce } from 'usehooks-ts'
import { Web3Storage } from 'web3.storage'
import { ReactComponent as ETHLogo } from '../../assets/images/eth-logo.svg'
import { ReactComponent as PolygonLogo } from '../../assets/images/polygon-logo.svg'
import { extractErrorMessage } from '../../utils/helper'
import { contracts } from '../../utils/contracts'
import WithTxConfirmation from '../WithTxConfirmation'
import { useLoading } from '../../context/loading-context'
import WithTxInProgress from '../WithTxInProgress'
import Credit from '../../assets/images/credit.jpeg'

interface MintDrawerProps {
  onClose: () => void
  isOpen: boolean
  reexecuteQuery: (params: any) => void
}

const DEBOUNCE_PERIOD = 500

const MintDrawer: FC<MintDrawerProps> = ({ onClose, isOpen, reexecuteQuery }) => {
  const focusField = React.useRef() as React.RefObject<HTMLInputElement>

  const { address } = useAccount()
  const { chain } = useNetwork()
  
  const toast = useToast()
  const toastBgColor = useColorModeValue('white', 'red')
  const toastWarningBgColor = useColorModeValue('white', 'yellow.900')

  const { setIsOverlayLoading, setLoadingText } = useLoading()
  
  const [noteName, setNoteName] = useState<string>('')
  const debouncedNoteName = useDebounce(noteName, DEBOUNCE_PERIOD)
  const [amount, setAmount] = useState<number>()
  const debouncedAmount = useDebounce(amount, DEBOUNCE_PERIOD)
  const [description, setDescription] = useState<string>('')
  const [slotImg, setSlotImg] = useState<string>('credit')
  const [uploadedImg, setUploadedImg] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [image, setImage] = useState('https://ipfs.io/ipfs/bafkreig4op2kb3ros652lmzitec5ly76dkjtbh23poz2fkq6sscp67i4e4')
  const debouncedDescription = useDebounce(description, DEBOUNCE_PERIOD)

  const onDrop = useCallback(async (acceptedFiles: any) => {
    try {
      const file = acceptedFiles[0]
      if (!file) return

      setIsUploading(true)
      setUploadedImg(Object.assign(file, { preview: URL.createObjectURL(file) }))
      
      const client = new Web3Storage({ token: process.env.REACT_APP_WEB3_STORAGE_API_KEY || '' })
      const rootCid = await client.put(acceptedFiles)
      const res = await client.get(rootCid)
      const files = await res?.files()
      const cid = files?.[0].cid.toString()
      setImage(cid ? `https://ipfs.io/ipfs/${cid}` : image)
    } catch(err) {
      console.log(err)
    } finally {
      setIsUploading(false)
    }
  }, [image])

  const {getRootProps, getInputProps, isDragActive} = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: isUploading
  })

  const isMintable = (): boolean => {
    return !!address && !!debouncedNoteName && !!debouncedDescription && !!debouncedAmount
  }

  const {
    config,
    error: prepareError,
    isError: isPrepareError,
  } = usePrepareContractWrite({
    address: contracts[`${chain?.id as number}`],
    abi: [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "onBehalfOf_",
            "type": "address"
          },
          {
            "components": [
              {
                "internalType": "string",
                "name": "name",
                "type": "string"
              },
              {
                "internalType": "string",
                "name": "description",
                "type": "string"
              },
              {
                "internalType": "string",
                "name": "image",
                "type": "string"
              },
              {
                "internalType": "address",
                "name": "underlying",
                "type": "address"
              }
            ],
            "internalType": "struct ICryptonotes.SlotDetail",
            "name": "slotDetail_",
            "type": "tuple"
          },
          {
            "internalType": "uint256",
            "name": "value_",
            "type": "uint256"
          }
        ],
        "name": "mint",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      }
    ],
    functionName: 'mint',
    args: [
      address!,
      {
        name: debouncedNoteName,
        description: debouncedDescription,
        image,
        underlying: constants.AddressZero, // zero address for ETH on Ethereum networks
      },
      utils.parseEther(debouncedAmount?.toString() || '0'),
    ],
    overrides: {
      value: utils.parseEther(debouncedAmount?.toString() || '0'),
    },
    enabled: isMintable(),
  })

  const { data, error, isError, write, isLoading: isWriting } = useContractWrite({
    ...config,
    request: config.request,
  })
 
  const {
    isLoading,
    isSuccess,
    isError: isWaitTxError,
    error: waitTxError
  } = useWaitForTransaction({
    hash: data?.hash,
    confirmations: 2,
  })

  useEffect(() => {
    setLoadingText(<WithTxInProgress txHash={data?.hash} chainId={chain?.id} />)
  }, [setLoadingText, data?.hash, chain?.id])

  useEffect(() => {
    const resetAndClose = () => {
      onClose()
      setNoteName('')
      setAmount(undefined)
      setDescription('')
      setIsOverlayLoading(false)
    }

    if (isSuccess) {
      toast({
        title: '🎉 Mint Note',
        position: 'bottom-right',
        variant: 'left-accent',
        description: `Successfully minted your note!`,
        status: 'success',
        duration: 9000,
        isClosable: true,
      })
      resetAndClose()
      reexecuteQuery({ requestPolicy: 'network-only' })
    }
  }, [isSuccess, toast, onClose, setIsOverlayLoading, reexecuteQuery])

  useEffect(() => {
    if (isPrepareError) {
      toast({
        title: `⚠️ Mint Note Warning`,
        position: 'bottom-right',
        variant: 'left-accent',
        description: `${extractErrorMessage(prepareError)}`,
        status: 'warning',
        duration: 9000,
        isClosable: true,
        containerStyle: {
          background: toastWarningBgColor,
          borderRadius: '0.5rem',
        }
      })
    }
  }, [prepareError, isPrepareError, toast, toastWarningBgColor])

  useEffect(() => {
    if (isError || isWaitTxError) {
      toast({
        title: `😱 Mint Note Error`,
        position: 'bottom-right',
        variant: 'left-accent',
        description: `${extractErrorMessage(error || waitTxError)}`,
        status: 'error',
        duration: 9000,
        isClosable: true,
        containerStyle: {
          background: toastBgColor,
          borderRadius: '0.5rem',
        }
      })
      setIsOverlayLoading(false)
    }
  }, [error, isError, waitTxError, isWaitTxError, toast, toastBgColor, setIsOverlayLoading])

  const onMinting = useCallback(() => {
    setIsOverlayLoading(true)
    setLoadingText(<WithTxConfirmation />)
    write?.()
  }, [write, setIsOverlayLoading, setLoadingText])

  useEffect(() => {
    return () => URL.revokeObjectURL((uploadedImg as any).preview)
  }, [uploadedImg])

  return (
    <>
      <Drawer
        onClose={onClose}
        isOpen={isOpen}
        size={'xl'}
        placement='right'
        initialFocusRef={focusField}
        closeOnOverlayClick={false}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>Mint a new cryptonote</DrawerHeader>

          <DrawerBody>
            <Stack spacing='24px'>
              <Box>
                <FormLabel htmlFor='noteName'>Note Name</FormLabel>
                <Input
                  ref={focusField}
                  id='noteName'
                  placeholder='Please enter note name'
                  readOnly={isWriting}
                  value={noteName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNoteName(e.target.value)}
                />
              </Box>

              <Box>
                <FormLabel htmlFor='amount'>Deposit Amount</FormLabel>
                <InputGroup>
                  <InputLeftAddon py={2}>
                    {
                      chain?.id === 80001 ? <PolygonLogo height={25} /> : <ETHLogo height={25} />
                    }
                  </InputLeftAddon>
                  <NumberInput
                    id='amount'
                    placeholder='Please enter deposit amount'
                    defaultValue={amount}
                    min={0}
                    step={0.01}
                    w={'50rem'}
                    onChange={(value: string) => setAmount(Number(value))}
                  >
                    <NumberInputField
                      value={amount}
                      borderLeftRadius={0}
                      readOnly={isWriting}
                    />
                    {
                      !isWriting && (
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      )
                    }
                  </NumberInput>
                </InputGroup>
              </Box>

              <Box>
                <FormLabel htmlFor='slotImg'>Background Image</FormLabel>
                <Select disabled={isUploading || isWriting} id='slotImg' onChange={(e) => setSlotImg(e.target.value)}>
                  <option value='credit'>Credit Template</option>
                  <option value='custom'>Customization</option>
                </Select>
              </Box>

              {
                slotImg === 'custom' ? (
                  <>
                    {
                      !isUploading && (
                        <Box
                          {...getRootProps()}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '20px',
                            borderWidth: '2px',
                            borderRadius: '2px',
                            borderColor: '#eeeeee',
                            borderStyle: 'dashed',
                            backgroundColor: '#fafafa',
                            color: '#bdbdbd',
                            outline: 'none',
                            transition: 'border .24s ease-in-out'
                          }}
                        >
                          <input {...getInputProps()} />
                          {
                            isDragActive ?
                              <p>Drop the file here ...</p> :
                              <p>Drag 'n' drop your file here, or click to select file</p>
                          }
                        </Box>
                      )
                    }

                    <HStack justify={'center'}>
                      {
                        isUploading ? <Spinner /> : uploadedImg ? ( 
                          <Image h={200} src={(uploadedImg as any).preview} onLoad={() => { URL.revokeObjectURL((uploadedImg as any).preview) }} />
                        ) : ''
                      }
                    </HStack>
                  </>
                ) : slotImg === 'credit' && (
                  <HStack justify={'center'}>
                    <Image w={500} h={200} src={Credit} />
                  </HStack>
                )
              }

              {/* <Box>
                <FormLabel htmlFor='underlying'>Underlying Asset</FormLabel>
                <Select id='underlying'>
                  <option value='ETH'>ETH</option>
                  <option value='USDT'>USDT</option>
                </Select>
              </Box> */}

              <Box>
                <FormLabel htmlFor='desc'>Description</FormLabel>
                <Textarea
                  id='desc'
                  value={description}
                  readOnly={isWriting}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                />
              </Box>
            </Stack>
          </DrawerBody>

          <DrawerFooter borderTopWidth='1px'>
            <Button variant='outline' mr={3} onClick={onClose} disabled={isLoading || isWriting}>
              Cancel
            </Button>
            <Button
              colorScheme='cyan'
              onClick={() => onMinting()}
              disabled={!isMintable() || !write || isLoading || isWriting || isUploading}
              isLoading={isLoading || isWriting}
              loadingText={'Minting...'}
            >Mint</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export default MintDrawer
