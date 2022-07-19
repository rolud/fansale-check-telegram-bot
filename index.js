const axios = require('axios')
const TelegramBot = require('node-telegram-bot-api')
const fs = require('fs')
const path = require('path')

const INTERVAL = 300000
// const INTERVAL = 4000

// const EVENT_ID = '12763527' // BRUNORI lucca
// const EVENT_ID = '14946652' // PTN MATERA

const FANSALE_BUY_URL = 'https://www.fansale.it/fansale/tickets/pop-amp-rock/pinguini-tattici-nucleari/558153/14946652'
const FANSALE_BUY_BASE_URL = 'https://www.fansale.it'

const { TELEGRAM_TOKEN } = require('./config')

const bot = new TelegramBot(TELEGRAM_TOKEN, {polling:true})

const axiosInstance = axios.create({
    baseURL: 'https://www.fansale.it/',
    headers: {
        Accept: 'application/json'
    }
})


const fetchData = async (eventId) => {

    try {

        const resp = await axiosInstance.request({
            url: 'fansale/json/offer',
            methot: 'GET',
            params: {
                groupEventId: eventId,
                maxResults: '2500',
                dataMode: 'evdetails',
                addPrerenderedList: 'false',
                _: '1658233796409'
            }
        })
        
        
        const availableTickets = resp.data.offers.reduce((acc, curr) => acc + curr.currentAmount, 0)
        
        const cleanedEventName = resp.data.offers[0]?.cleanedEventName
        const initialOfferUrl = resp.data.offers[0]?.initialOfferUrl

        console.log('res', availableTickets)
   
        return { availableTickets, cleanedEventName, initialOfferUrl}
    } catch (error) {
        console.error('mannaggia cazzo', error)
    }
}

const subscribe = (chatId, eventId) => {
    setInterval(async () => {
        const res = await fetchData(eventId)
        const { availableTickets, cleanedEventName, initialOfferUrl } = res
        if (availableTickets > 0) {
            bot.sendMessage(chatId, `Ehi sono disponibili ${availableTickets} biglietti per ${cleanedEventName}!\n\nComprali qui: ${FANSALE_BUY_BASE_URL}${initialOfferUrl}`)
        }

    }, INTERVAL)
}

const main = async () => {


    try {
        const data = fs.readFileSync('./data', 'ascii')

        data.split('\n').forEach((line) => {
            const [chatId, eventId] = line.split(' ')
            if (chatId && eventId) {
                console.log('chatId', chatId, 'eventId', eventId)
                subscribe(chatId, eventId)
            }
        })
    } catch (error) {
        console.error('failed to read data file', error)
    }
   
    bot.onText(/\/start/, async (msg, match) => {
        const { chat } = msg
        bot.sendMessage(chat.id, `Ciao, inviami il link dell'evento FanSALE che vuoi seguire!`)
    })

    bot.on('message', async (msg) => {
        const { chat, text } = msg

        const pathElements = text.toString().split('/')
        if (pathElements !== undefined && pathElements.length > 0 && pathElements.includes('www.fansale.it')) {
            const eventId = pathElements[pathElements.length - 1]

            console.log('event id', eventId)
            
            let canSubscribe = true
            try {
    
                const data2 = fs.readFileSync('./data', 'ascii')
                data2.split('\n').forEach((line) => {
                    const [chatId, id] = line.split(' ')
                    if (chatId == chat.id && id == eventId) {
                        canSubscribe = false
                        return
                    }
                })
    
    
                if (canSubscribe){
    
                    bot.sendMessage(chat.id, `Ehi ciao, controllerò per te ogni ${INTERVAL / 60000} minuti se sono disponibili biglietti per l'evento che hai richiesto. Non appena troverò dei biglietti ti invierò un messaggio!`)
                    
                    const res = await fetchData(eventId)
                    const { availableTickets, cleanedEventName, initialOfferUrl } = res
                    bot.sendMessage(chat.id, `Al momento sono disponibili ${availableTickets} biglietti per ${cleanedEventName}!\n\n${availableTickets > 0 ? `Comprali qui: ${FANSALE_BUY_BASE_URL}${initialOfferUrl}` : 'Stay tuned 😉'}`)
                    
                    fs.writeFileSync('./data', `${chat.id} ${eventId}\n`, { flag: 'a+' })
                    
                    subscribe(chat.id, eventId)
                } 
            } catch (error) {
                console.log('handling message error', error)
            }
        } else {
            if (!text.toString().startsWith('/')) {
                bot.sendMessage(chat.id, 'Uh oh! Sembra tu abbia inviato qualcosa di sbagliato, riprova.')
            }
        }

    })

    bot.on('polling_error', (err) => console.error(err))
}

main()