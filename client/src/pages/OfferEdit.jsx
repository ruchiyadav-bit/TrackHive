import { useParams } from 'react-router-dom';
import OfferWizard from '../components/offers/OfferWizard';

export default function OfferEdit() {
 const { id } = useParams();
 return <OfferWizard offerId={id} />;
}
