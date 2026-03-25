import { Suspense, useEffect, useMemo } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'

import { useTranslation } from '@pancakeswap/localization'
import {
  AutoRenewIcon,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  Input,
  ReactMarkdown,
  ScanLink,
  Spinner,
  Text,
  TooltipText,
  useModal,
  useToast,
  useTooltip,
} from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import truncateHash from '@pancakeswap/utils/truncateHash'
import snapshot from '@snapshot-labs/snapshot.js'
import ConnectWalletButton from 'components/ConnectWalletButton'
import Container from 'components/Layout/Container'
import { useAtomValue } from 'jotai'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useInitialBlock } from 'state/block/hooks'
import { ProposalTypeName } from 'state/types'
import styled from 'styled-components'
import { DatePicker, DatePickerPortal, TimePicker } from 'views/Voting/components/DatePicker'
import { useAccount, useWalletClient } from 'wagmi'
import { SpinnerPage } from 'components/SpinnerPage'
import { spaceAtom } from '../atom/spaceAtom'
import Layout from '../components/Layout'
import VoteDetailsModal from '../components/VoteDetailsModal'
import { PANCAKE_SPACE, VOTE_THRESHOLD } from '../config'
import useGetVotingPower from '../hooks/useGetVotingPower'
import Choices, { MINIMUM_CHOICES, makeChoice } from './Choices'
import { combineDateAndTime, getFormErrors } from './helpers' // You can adapt or remove this
import { FormErrors, Label, SecondaryLabel } from './styles'

// Dynamically import EasyMde for SSR
const EasyMde = dynamic(() => import('components/EasyMde'), {
  ssr: false,
})

const hub = 'https://hub.snapshot.org'
const client = new snapshot.Client712(hub)

function getEndTime(startTime: Date | null, period?: number) {
  if (!startTime) return null
  return period ? new Date(startTime.getTime() + period * 1000) : null
}

const CreateProposal = () => {
  const { t } = useTranslation()
  const space = useAtomValue(spaceAtom)
  const { toastSuccess, toastError } = useToast()

  const { address: account } = useAccount()
  const { data: signer } = useWalletClient()
  const initialBlock = useInitialBlock()
  const { delay, period } = space?.voting || {}
  const created = useMemo(() => Math.floor(Date.now() / 1000), []) // current timestamp in seconds
  const { push } = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      body: '',
      // Pre-fill the choices array with the minimum required
      choices: Array.from({ length: MINIMUM_CHOICES }).map(() => makeChoice()),
      startDate: delay ? new Date((created + delay) * 1000) : null,
      startTime: delay ? new Date((created + delay) * 1000) : null,
      endDate: period ? getEndTime(delay ? new Date((created + delay) * 1000) : null, period) : null,
      endTime: period ? getEndTime(delay ? new Date((created + delay) * 1000) : null, period) : null,
      snapshot: 0,
    },
  })

  const { total, isLoading } = useGetVotingPower(watch('snapshot'))
  const enoughVotingPower = total >= VOTE_THRESHOLD

  const {
    fields: choiceFields,
    replace: replaceChoices,
    // If you want to let users add more choices, you can do:
    // append, remove, etc.
  } = useFieldArray({
    control,
    name: 'choices',
  })

  const startDate_ = watch('startDate')
  const startTime_ = watch('startTime')

  useEffect(() => {
    if (period && startDate_ && startTime_) {
      const combinedStart = combineDateAndTime(startDate_, startTime_)
      if (combinedStart) {
        const date = new Date(combinedStart * 1000)
        const newEnd = new Date(date.getTime() + period * 1000)
        setValue('endDate', newEnd)
        setValue('endTime', newEnd)
      }
    }
  }, [startDate_, startTime_, period, setValue])

  useEffect(() => {
    if (initialBlock > 0) {
      setValue('snapshot', Number(initialBlock))
    }
  }, [initialBlock, setValue])

  const [onPresentVoteDetailsModal] = useModal(<VoteDetailsModal block={watch('snapshot')} />)

  const votingPowerTooltipContent = t(
    'Your voting power is determined by your CAKE balance at the snapshot block, which represents how much weight your vote carries.',
  )
  const {
    targetRef: votingPowerTargetRef,
    tooltip: votingPowerTooltip,
    tooltipVisible: votingPowerTooltipVisible,
  } = useTooltip(<Text>{votingPowerTooltipContent}</Text>, {
    placement: 'top',
  })

  const onSubmit = async (data: any) => {
    if (!account) return

    const formErrors = getFormErrors(data, t)
    if (Object.keys(formErrors).length > 0) {
      toastError(t('Error'), t('Please fix form errors.'))
      return
    }

    try {
      const web3 = {
        getSigner: () => ({
          _signTypedData: (domain: any, types: any, message: any) =>
            signer?.signTypedData({
              account,
              domain,
              types,
              message,
              primaryType: 'Proposal',
            }),
        }),
      }

      const { name, body, choices, startDate, startTime, endDate, endTime, snapshot: snapshotNum } = data

      // Combine date/time into seconds
      const start = combineDateAndTime(startDate, startTime) || 0
      const end = combineDateAndTime(endDate, endTime) || 0

      const resData: any = await client.proposal(web3 as any, account, {
        space: PANCAKE_SPACE,
        type: ProposalTypeName.SINGLE_CHOICE, // Keep or adapt to your type
        title: name,
        body,
        timestamp: created,
        start,
        end,
        choices: choices.filter((choice: any) => choice.value).map((choice: any) => choice.value),
        snapshot: snapshotNum,
        discussion: '',
        plugins: JSON.stringify({}),
        app: 'snapshot',
      })

      // Redirect user to newly created proposal page
      push(`/voting/proposal/${resData.id}`)
      toastSuccess(t('Proposal created!'))
    } catch (error) {
      toastError(t('Error'), (error as Error)?.message)
      console.error(error)
    }
  }

  if (!space) {
    return <Box>{t('Network unstable. Please refresh to continue.')}</Box>
  }

  return (
    <Container py="40px">
      <Box mb="48px">
        <Breadcrumbs>
          <Link href="/">{t('Home')}</Link>
          <Link href="/voting">{t('Voting')}</Link>
          <Text>{t('Make a Proposal')}</Text>
        </Breadcrumbs>
      </Box>
      {/* Use react-hook-form's handleSubmit */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Layout>
          {/* Left side */}
          <Box>
            <Box mb="24px">
              <Label htmlFor="name">{t('Title')}</Label>
              <Input
                id="name"
                // register returns an object of onChange, onBlur, ref, etc.
                // Provide valiions inline or via a validation resolver.
                // e.g. required: t('Title is required')
                {...register('name', { required: t('Title is required') as string })}
                scale="lg"
              />
              {errors.name && <FormErrors errors={[errors.name.message as string]} />}
            </Box>
            <Box mb="24px">
              <Label htmlFor="body">{t('Content')}</Label>
              <Text color="textSubtle" mb="8px">
                {t('Tip: write in Markdown!')}
              </Text>

              <Controller
                control={control}
                name="body"
                rules={{ required: t('Content is required') as string }}
                render={({ field: { onChange, onBlur, value, name } }) => (
                  <EasyMde id="body" name={name} value={value} onTextChange={onChange} onBlur={onBlur} />
                )}
              />
              {errors.body && <FormErrors errors={[errors.body.message as string]} />}
            </Box>

            {/* Markdown Preview */}
            {/* You can simply watch('body') to get the field’s current value */}
            {watch('body') && (
              <Box mb="24px">
                <Card>
                  <CardHeader>
                    <Heading as="h3" scale="md">
                      {t('Preview')}
                    </Heading>
                  </CardHeader>
                  <CardBody p="0" px="24px">
                    <ReactMarkdown>{watch('body')}</ReactMarkdown>
                  </CardBody>
                </Card>
              </Box>
            )}

            {/* Choices (using a field array) */}
            <Controller
              control={control}
              name="choices"
              render={({ field }) => (
                <Choices choices={field.value} onChange={(newChoices) => replaceChoices(newChoices)} />
              )}
            />
            {/* If you want to show any errors for choices: */}
            {errors.choices && <FormErrors errors={[t('Please provide valid choices')]} />}
          </Box>

          {/* Right side */}
          <Box>
            <Card>
              <CardHeader>
                <Heading as="h3" scale="md">
                  {t('Actions')}
                </Heading>
              </CardHeader>
              <CardBody>
                <Box mb="24px">
                  <SecondaryLabel>{t('Start Date')}</SecondaryLabel>
                  <Controller
                    control={control}
                    name="startDate"
                    // If you want to disable the datepicker by default if `delay` is set:
                    render={({ field }) => (
                      <DatePicker
                        disabled={Boolean(delay)}
                        placeholderText="YYYY/MM/DD"
                        selected={field.value}
                        onChange={(date) => field.onChange(date)}
                      />
                    )}
                  />
                  {errors.startDate && <FormErrors errors={[errors.startDate.message as string]} />}
                </Box>

                <Box mb="24px">
                  <SecondaryLabel>{t('Start Time')}</SecondaryLabel>
                  <Controller
                    control={control}
                    name="startTime"
                    render={({ field }) => (
                      <TimePicker
                        disabled={Boolean(delay)}
                        placeholderText="00:00"
                        selected={field.value}
                        onChange={(date) => field.onChange(date)}
                      />
                    )}
                  />
                  {errors.startTime && <FormErrors errors={[errors.startTime.message as string]} />}
                </Box>

                <Box mb="24px">
                  <SecondaryLabel>{t('End Date')}</SecondaryLabel>
                  <Controller
                    control={control}
                    name="endDate"
                    render={({ field }) => (
                      <DatePicker
                        disabled={Boolean(period)}
                        placeholderText="YYYY/MM/DD"
                        selected={field.value}
                        onChange={(date) => field.onChange(date)}
                      />
                    )}
                  />
                  {errors.endDate && <FormErrors errors={[errors.endDate.message as string]} />}
                </Box>

                <Box mb="24px">
                  <SecondaryLabel>{t('End Time')}</SecondaryLabel>
                  <Controller
                    control={control}
                    name="endTime"
                    render={({ field }) => (
                      <TimePicker
                        disabled={Boolean(period)}
                        placeholderText="00:00"
                        selected={field.value}
                        onChange={(date) => field.onChange(date)}
                      />
                    )}
                  />
                  {errors.endTime && <FormErrors errors={[errors.endTime.message as string]} />}
                </Box>

                {account && (
                  <Flex alignItems="center" mb="8px">
                    <Text color="textSubtle" mr="16px">
                      {t('Creator')}
                    </Text>
                    <ScanLink useBscCoinFallback href={`https://bscscan.com/address/${account}`}>
                      {truncateHash(account)}
                    </ScanLink>
                  </Flex>
                )}

                <Flex alignItems="center" mb="8px">
                  <Text color="textSubtle" mr="16px">
                    {t('Voting Power')}
                  </Text>
                  <Box ml="8px">
                    <TooltipText ref={votingPowerTargetRef}>
                      {isLoading ? '-' : formatNumber(total ?? 0, { maxDecimalDisplayDigits: 2 })}
                    </TooltipText>
                    {votingPowerTooltipVisible && votingPowerTooltip}
                  </Box>
                </Flex>

                {/* Snapshot */}
                <Flex alignItems="center" mb="16px">
                  <Text color="textSubtle" mr="16px">
                    {t('Snapshot')}
                  </Text>
                  <ScanLink useBscCoinFallback href={`https://bscscan.com/block/${watch('snapshot')}`}>
                    {watch('snapshot')}
                  </ScanLink>
                </Flex>

                {account ? (
                  <>
                    <Button
                      type="submit"
                      width="100%"
                      disabled={isSubmitting || !enoughVotingPower || isLoading}
                      endIcon={isSubmitting ? <AutoRenewIcon spin color="currentColor" /> : null}
                      mb="16px"
                    >
                      {t('Publish')}
                    </Button>
                    {!enoughVotingPower && (
                      <Text color="failure" as="p" mb="4px">
                        {t('You need at least %count% voting power to publish a proposal.', {
                          count: VOTE_THRESHOLD,
                        })}
                      </Text>
                    )}
                    <Button scale="sm" type="button" variant="text" onClick={onPresentVoteDetailsModal} p={0}>
                      {t('Check voting power')}
                    </Button>
                  </>
                ) : (
                  <ConnectWalletButton width="100%" type="button" />
                )}
              </CardBody>
            </Card>
          </Box>
        </Layout>
      </form>
      <DatePickerPortal />
    </Container>
  )
}

const Wrapped = () => {
  return (
    <Suspense fallback={<SpinnerPage />}>
      <CreateProposal />
    </Suspense>
  )
}

export default Wrapped
