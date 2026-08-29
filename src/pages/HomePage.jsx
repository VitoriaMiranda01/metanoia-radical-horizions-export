import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { ChevronDown, ChevronUp, Heart, Calendar, DollarSign, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LandingNav from '@/components/landing/LandingNav';
import { useCurrentPrice } from '@/hooks/useCurrentPrice';
import { fetchEventoDatas, subscribeToConfiguracoesChanges } from '@/services/organizerConfigService';
const FadeIn = ({
  children,
  delay = 0,
  className = ""
}) => <motion.div initial={{
  opacity: 0,
  y: 30
}} whileInView={{
  opacity: 1,
  y: 0
}} viewport={{
  once: true,
  margin: "-100px"
}} transition={{
  duration: 0.6,
  delay
}} className={className}>
    {children}
  </motion.div>;
const FaqItem = ({
  question,
  answer,
  isOpen,
  onClick
}) => <motion.div initial={false} className={`border rounded-xl overflow-hidden transition-all duration-300 ${isOpen ? 'border-red-500/50 bg-white/5' : 'border-white/10 bg-black'}`}>
    <button onClick={onClick} className="w-full px-6 py-4 text-left flex justify-between items-center focus:outline-none">
      <span className={`font-medium text-lg ${isOpen ? 'text-red-400' : 'text-gray-200'}`}>{question}</span>
      {isOpen ? <ChevronUp className="text-red-400" /> : <ChevronDown className="text-gray-500" />}
    </button>
    <AnimatePresence>
      {isOpen && <motion.div initial={{
      height: 0,
      opacity: 0
    }} animate={{
      height: "auto",
      opacity: 1
    }} exit={{
      height: 0,
      opacity: 0
    }} transition={{
      duration: 0.3
    }}>
          <div className="px-6 pb-4 text-gray-400 leading-relaxed border-t border-white/5 pt-4">
            {answer}
          </div>
        </motion.div>}
    </AnimatePresence>
  </motion.div>;
const HomePage = () => {
  const navigate = useNavigate();
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [formattedDate, setFormattedDate] = useState("Data não configurada");
  const [dateLoading, setDateLoading] = useState(true);
  const [edicaoNumero, setEdicaoNumero] = useState(null);
  const {
    currentPrice,
    loading: priceLoading
  } = useCurrentPrice();
  useEffect(() => {
    const fetchDates = async () => {
      try {
        setDateLoading(true);
        const {
          data,
          error
        } = await fetchEventoDatas();
        if (error && error.code === 'PGRST116') {
          setFormattedDate("Data não configurada");
          setEdicaoNumero(null);
          return;
        } else if (error) {
          throw error;
        }
        if (data) {
          setEdicaoNumero(data.edicao_numero || null);
          if (data.data_evento_inicio && data.data_evento_fim) {
            const [y1, m1, d1] = data.data_evento_inicio.split('-');
            const [y2, m2, d2] = data.data_evento_fim.split('-');
            const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const monthName = months[parseInt(m1, 10) - 1];
            setFormattedDate(`${parseInt(d1, 10)} - ${parseInt(d2, 10)} de ${monthName} de ${y1}`);
          } else {
            setFormattedDate("Data não configurada");
          }
        }
      } catch (error) {
        console.error("Erro ao buscar configurações:", error);
        setFormattedDate("Data não configurada");
        setEdicaoNumero(null);
      } finally {
        setDateLoading(false);
      }
    };
    fetchDates();
    const unsubscribe = subscribeToConfiguracoesChanges('homepage_config', () => {
      fetchDates();
    });
    return () => {
      unsubscribe();
    };
  }, []);
  const faqs = [{
    q: "Qual a faixa etária do Metanoia Radical Serra?",
    a: "O Metanoia Radical Serra é voltado para pessoas de no mínimo 15 anos."
  }, {
    q: "Como faço para participar da equipe de trabalho?",
    a: "Para ser equipante, é necessário ter participado de pelo menos uma edição anterior como acampante. Se você atende a este requisito, clique no botão 'Área dos Equipantes' e faça sua inscrição."
  }, {
    q: "Como faço para garantir minha inscrição?",
    a: "Sua inscrição é confirmada após o preenchimento da ficha online e a confirmação do pagamento. As vagas são limitadas, então recomendamos fazer sua inscrição o quanto antes."
  }, {
    q: "Quais são as formas de pagamento disponíveis?",
    a: "Aceitamos pagamentos via PIX, transferência bancária e, em alguns casos, parcelamento no cartão de crédito. Os detalhes específicos estão disponíveis na página de pagamento após preencher a ficha."
  }];
  return <>
      <Helmet>
        <title>Metanoia Radical Serra - Home</title>
        <meta name="description" content="Bem-vindo ao Metanoia Radical Serra. Amar com o amor de Jesus!" />
      </Helmet>

      <div className="min-h-screen bg-black text-white font-sans selection:bg-red-500/30">
        <LandingNav />

        <section className="relative h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/whatsapp-image-2026-03-02-at-20.34.03-Tff86.jpeg" alt="Metanoia Radical Background" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60" />
            <div className="absolute inset-0 bg-red-900/10 mix-blend-overlay" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              <div className="space-y-6 text-center lg:text-left">
                <motion.div initial={{
                opacity: 0,
                x: -50
              }} animate={{
                opacity: 1,
                x: 0
              }} transition={{
                duration: 0.8
              }}>
                  <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-4">
                    Bem-vindo ao <br />
                    <span className="text-white">Metanoia</span>{' '}
                    <span className="text-red-600">Radical</span>{' '}
                    <span className="text-green-600">Serra</span>
                  </h1>
                  <p className="text-xl md:text-2xl text-gray-300 font-light italic border-l-4 border-red-500 pl-4 py-1">"Amar com o amor de Jesus!"</p>
                </motion.div>
              </div>

              <motion.div initial={{
              opacity: 0,
              y: 50
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.8,
              delay: 0.2
            }} className="flex justify-center lg:justify-end">
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-3xl shadow-2xl max-w-md w-full relative group">
                  <div className="absolute -top-4 -left-4 bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg">
                    PRÓXIMA EDIÇÃO
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-medium text-white mb-2">
                        {edicaoNumero ? `${edicaoNumero}° Edição Metanoia Radical Serra` : "Edição Metanoia Radical Serra"}
                      </h3>
                      <div className="h-1 w-20 bg-red-600 rounded-full"></div>
                    </div>

                    <div className="space-y-4 text-gray-300">
                      <div className="flex items-center space-x-3">
                        <Calendar className="text-red-500 w-5 h-5" />
                        {dateLoading ? <div className="h-5 w-48 bg-white/10 animate-pulse rounded"></div> : <span>{formattedDate}</span>}
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <DollarSign className="text-red-500 w-5 h-5" />
                        {priceLoading ? <div className="h-5 w-32 bg-white/10 animate-pulse rounded"></div> : currentPrice ? <span>Investimento: <strong>R$ {parseFloat(currentPrice).toFixed(2).replace('.', ',')}</strong></span> : <span>Investimento: <strong>Valores indisponíveis</strong></span>}
                      </div>
                    </div>

                    <Button onClick={() => navigate('/acampante')} className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-6 text-lg rounded-xl shadow-lg shadow-red-900/30 transition-all transform group-hover:scale-[1.02]">
                      Inscrever-se
                    </Button>
                    <p className="text-xs text-center text-gray-500 mt-2">*Vagas limitadas</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          <motion.div animate={{
          y: [0, 10, 0]
        }} transition={{
          repeat: Infinity,
          duration: 2
        }} className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/50">
            <ChevronDown className="w-8 h-8" />
          </motion.div>
        </section>

        <section className="py-20 bg-neutral-900 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

              <FadeIn className="space-y-8">
                <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                  Você deseja <span className="text-green-600 font-black">SERVIR</span> no <br />
                  Metanoia Radical Serra?
                </h2>
                <p className="text-lg text-gray-300 leading-relaxed border-l-4 border-green-600 pl-6">
                  "Pois nem mesmo o Filho do homem veio para ser servido, mas para servir e dar a sua vida em resgate por muitos." <br />
                  <span className="text-sm text-gray-500 mt-2 block">- Marcos 10:45</span>
                </p>
                <p className="text-gray-400">
                  Se você já participou de alguma edição do Metanoia Radical Serra como acampante e sente o chamado para servir nos bastidores, junte-se à nossa equipe!
                </p>
                <Button onClick={() => navigate('/equipante')} className="bg-red-600 hover:bg-red-700 text-white text-lg px-8 py-6 rounded-xl shadow-lg shadow-red-900/20 transition-all transform hover:translate-x-2">
                  Inscrever-se
                </Button>
              </FadeIn>

              <FadeIn delay={0.3} className="relative">
                <div className="relative z-10 grid grid-cols-2 gap-4">
                  <img src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/whatsapp-image-2026-07-26-at-16.20.51-qYEwA.jpeg" alt="Serving Hands with Bracelets" className="rounded-2xl shadow-2xl object-cover h-64 w-full transform translate-y-8" />
                  <img src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/whatsapp-image-2026-03-02-at-20.20.58-TLPmn.jpeg" alt="Serving 2" className="rounded-2xl shadow-2xl object-cover h-64 w-full" />
                </div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-green-600/20 rounded-full blur-3xl z-0"></div>
              </FadeIn>

            </div>
          </div>
        </section>

        <section className="py-20 bg-neutral-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="relative group rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                <img src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/agenda-XjS5a.jpg" alt="Agenda 2026 Metanoia Radical" className="w-full h-auto object-contain transform transition-transform duration-500 group-hover:scale-[1.01]" />
              </div>
            </FadeIn>
          </div>
        </section>

        <section className="py-20 bg-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

              <FadeIn className="order-2 lg:order-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4 mt-8">
                    <img src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/whatsapp-image-2026-03-02-at-20.20.58-2-3IyKI.jpeg" alt="Gallery 1" className="rounded-xl shadow-lg hover:scale-105 transition-transform duration-500 object-cover h-48 w-full" />
                    <img src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/whatsapp-image-2026-03-02-at-20.24.50-1-CUbB0.jpeg" alt="Gallery 2" className="rounded-xl shadow-lg hover:scale-105 transition-transform duration-500 object-cover h-64 w-full" />
                  </div>
                  <div className="space-y-4">
                    <img src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/whatsapp-image-2026-03-02-at-20.20.58-3-MCQ2p.jpeg" alt="Gallery 3" className="rounded-xl shadow-lg hover:scale-105 transition-transform duration-500 object-cover h-64 w-full" />
                    <img src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/whatsapp-image-2026-03-02-at-20.24.49-bSyQe.jpeg" alt="Gallery 4" className="rounded-xl shadow-lg hover:scale-105 transition-transform duration-500 object-cover h-48 w-full" />
                  </div>
                </div>
              </FadeIn>

              <FadeIn className="order-1 lg:order-2 space-y-6">
                <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                  O que é o <br />
                  <span className="text-red-600">Metanoia Radical Serra</span>
                </h2>
                <div className="h-1.5 w-24 bg-gradient-to-r from-red-500 to-red-800 rounded-full"></div>
                <p className="text-lg text-gray-300 leading-relaxed">
                  O Radical é um encontro que simula a igreja perseguida, um momento em que você é confrontado consigo mesmo, refletindo sobre sua vida cristã e como reagir diante de diversas situações.
                </p>
                <p className="text-gray-400">
                  É uma experiência imersiva de fé, coragem e entrega, onde somos desafiados a viver o evangelho em sua essência, longe do conforto e das distrações do dia a dia.
                </p>
              </FadeIn>

            </div>
          </div>
        </section>

        <section className="py-20 bg-black">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Perguntas <span className="text-red-600">Frequentes</span></h2>
                <p className="text-gray-400">Tire suas dúvidas sobre o evento</p>
              </div>
            </FadeIn>

            <div className="space-y-4">
              {faqs.map((faq, index) => <FadeIn key={index} delay={index * 0.1}>
                  <FaqItem question={faq.q} answer={faq.a} isOpen={openFaqIndex === index} onClick={() => setOpenFaqIndex(index === openFaqIndex ? -1 : index)} />
                </FadeIn>)}
            </div>
          </div>
        </section>

        <footer className="bg-neutral-950 border-t border-white/10 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <p className="text-gray-500 text-sm">© 2026 Metanoia Radical Serra. Todos os direitos reservados.</p>
            </div>

            <div className="flex flex-col items-center md:items-end">
              <p className="text-gray-400 text-sm flex items-center gap-1">
                Desenvolvido com <Heart className="w-3 h-3 text-red-600 fill-red-600" /> por:
              </p>
              <a href="https://wa.me/5521979371559" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-400 font-medium text-sm transition-colors mt-1">Vitória Miranda</a>
            </div>
          </div>
        </footer>

        <a href="https://wa.me/5521976225702" target="_blank" rel="noopener noreferrer" className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:bg-[#20bd5a] transition-all transform hover:scale-110 flex items-center justify-center group" aria-label="Contato WhatsApp">
          <Phone className="w-6 h-6 fill-white" />
          <span className="absolute right-full mr-3 bg-white text-black text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Fale conosco
          </span>
        </a>

      </div>
    </>;
};
export default HomePage;